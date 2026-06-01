import { redirect } from 'next/navigation'
import ChangePasswordForm from '@/app/components/profile/ChangePasswordForm'
import { prisma } from '@/app/lib/prisma'
import { getSessionUser } from '@/app/lib/session'

const MODEL_TYPE_TENANT_USER = 'App\\Models\\TenantUser'

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="border-b border-neutral-100 py-3 last:border-b-0 dark:border-neutral-800">
      <dt className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-neutral-900 dark:text-white">{value || '-'}</dd>
    </div>
  )
}

export default async function MyProfilePage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')

  const user = await prisma.users.findUnique({
    where: { id: BigInt(sessionUser.id) },
    select: {
      name: true,
      email: true,
      phone_number: true,
    },
  })

  if (!user) redirect('/login')

  const tenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: BigInt(sessionUser.id) },
    orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      tenants: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const [tenantAddress, tenantRole] = tenantUser
    ? await Promise.all([
        prisma.addresses.findFirst({
          where: { tenant_id: tenantUser.tenants.id },
          orderBy: { id: 'asc' },
          select: { city_id: true, city: true },
        }),
        prisma.model_has_roles.findFirst({
          where: {
            model_type: MODEL_TYPE_TENANT_USER,
            model_id: tenantUser.id,
          },
          include: { roles: true },
          orderBy: { role_id: 'asc' },
        }),
      ])
    : [null, null]

  let city: { name: string; province_id: number | null } | null = null
  let province: { name: string } | null = null

  if (tenantAddress?.city_id != null) {
    city = await prisma.reg_cities.findUnique({
      where: { id: BigInt(tenantAddress.city_id) },
      select: { name: true, province_id: true },
    })
    if (city?.province_id != null) {
      province = await prisma.reg_provinces.findUnique({
        where: { id: city.province_id },
        select: { name: true },
      })
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Akun</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">Profil Saya</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Informasi akun, tenant aktif, dan pengaturan password Anda.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Informasi User</h2>
            <dl className="mt-3">
              <ProfileField label="Nama" value={user.name} />
              <ProfileField label="Email" value={user.email} />
              <ProfileField label="No. Telepon" value={user.phone_number} />
              <ProfileField label="Role" value={sessionUser.roles.join(', ')} />
            </dl>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Daerah</h2>
            <dl className="mt-3">
              <ProfileField label="Tenant" value={tenantUser?.tenants.name} />
              <ProfileField label="Provinsi" value={province?.name} />
              <ProfileField label="Kab/Kota" value={city?.name ?? tenantAddress?.city} />
              <ProfileField label="Role Tenant" value={tenantRole?.roles.name} />
            </dl>
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Ganti Password</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Masukkan password lama untuk mengamankan perubahan kredensial akun.
            </p>
          </div>
          <div className="mt-5 max-w-2xl">
            <ChangePasswordForm />
          </div>
        </section>
      </div>
    </div>
  )
}
