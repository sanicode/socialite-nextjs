import { prisma } from '@/app/lib/prisma'

export async function getRequiredSocialMediaCategoryCount() {
  return prisma.blog_post_categories.count({
    where: {
      is_active: true,
      is_required: true,
      deleted_at: null,
    },
  })
}

export function isOperatorReportValidationReady(
  uploadCount: number,
  amplifikasiCount: number,
  requiredCount: number,
) {
  return uploadCount >= requiredCount && amplifikasiCount >= requiredCount
}

export function getOperatorReportValidationDisabledMessage(requiredCount: number) {
  return `Validasi aktif setelah minimal ${requiredCount} upload dan ${requiredCount} amplifikasi terpenuhi.`
}

export function getOperatorReportValidationPendingMessage(requiredCount: number) {
  return `Status laporan akan tetap pending sampai operator memiliki minimal ${requiredCount} laporan upload dan ${requiredCount} laporan amplifikasi pada rentang tanggal ini.`
}
