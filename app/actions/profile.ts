'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/app/lib/authorization'
import { writeAccessLog } from '@/app/lib/access-logs'
import { logEvent } from '@/app/lib/logger'
import { PASSWORD_MIN_LENGTH, getPasswordPolicyChecks } from '@/app/lib/password-policy'
import { prisma } from '@/app/lib/prisma'

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword'

export type ChangePasswordState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  errors?: Partial<Record<PasswordField, string[]>>
}

function readPassword(formData: FormData, field: PasswordField): string {
  const value = formData.get(field)
  return typeof value === 'string' ? value : ''
}

export async function changeMyPassword(
  _previousState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const sessionUser = await requireUser()
  const currentPassword = readPassword(formData, 'currentPassword')
  const newPassword = readPassword(formData, 'newPassword')
  const confirmPassword = readPassword(formData, 'confirmPassword')
  const passwordChecks = getPasswordPolicyChecks(newPassword)
  const errors: ChangePasswordState['errors'] = {}

  if (!currentPassword) {
    errors.currentPassword = ['Password lama wajib diisi.']
  }

  const newPasswordErrors: string[] = []
  if (!passwordChecks.hasMinimumLength) {
    newPasswordErrors.push(`Password baru minimal ${PASSWORD_MIN_LENGTH} karakter.`)
  }
  if (!passwordChecks.hasLowercase) {
    newPasswordErrors.push('Password baru harus memiliki huruf kecil.')
  }
  if (!passwordChecks.hasUppercase) {
    newPasswordErrors.push('Password baru harus memiliki huruf besar.')
  }
  if (newPasswordErrors.length > 0) {
    errors.newPassword = newPasswordErrors
  }

  if (!confirmPassword) {
    errors.confirmPassword = ['Konfirmasi password baru wajib diisi.']
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = ['Konfirmasi password baru tidak cocok.']
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: 'error',
      message: 'Periksa kembali password yang Anda masukkan.',
      errors,
    }
  }

  const user = await prisma.users.findUnique({
    where: { id: BigInt(sessionUser.id) },
    select: { password: true },
  })

  if (!user) {
    return {
      status: 'error',
      message: 'Data user tidak ditemukan.',
    }
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password)
  if (!passwordMatches) {
    logEvent('warn', 'profile.password_change_failed', {
      userId: sessionUser.id,
      reason: 'current_password_mismatch',
    })
    await writeAccessLog({
      eventType: 'password_change_failed',
      status: 'failed',
      userId: sessionUser.id,
      userEmail: sessionUser.email,
      details: { reason: 'current_password_mismatch' },
    })
    return {
      status: 'error',
      message: 'Password lama tidak sesuai.',
      errors: {
        currentPassword: ['Password lama tidak sesuai.'],
      },
    }
  }

  if (currentPassword === newPassword) {
    return {
      status: 'error',
      message: 'Password baru harus berbeda dari password lama.',
      errors: {
        newPassword: ['Password baru harus berbeda dari password lama.'],
      },
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.users.update({
    where: { id: BigInt(sessionUser.id) },
    data: {
      password: passwordHash,
      updated_at: new Date(),
    },
  })

  logEvent('info', 'profile.password_changed', { userId: sessionUser.id })
  await writeAccessLog({
    eventType: 'password_changed',
    status: 'success',
    userId: sessionUser.id,
    userEmail: sessionUser.email,
  })
  revalidatePath('/myprofile')

  return {
    status: 'success',
    message: 'Password berhasil diperbarui.',
  }
}
