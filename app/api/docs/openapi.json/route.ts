import { getSessionUser } from '@/app/lib/session'

export const dynamic = 'force-dynamic'

const successResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
  },
}

const idResponse = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '101' },
  },
}

const deleteResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    deleted: { type: 'integer', example: 3 },
  },
}

type SchemaDefinition = {
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
  items?: unknown
  enum?: string[]
  example?: unknown
  description?: string
  format?: string
  nullable?: boolean
  default?: unknown
  additionalProperties?: unknown
  allOf?: unknown[]
}

type OpenApiSpec = {
  openapi: string
  info: {
    title: string
    version: string
    description: string
  }
  servers: Array<{ url: string; description: string }>
  tags: Array<{ name: string; description: string }>
  components: {
    securitySchemes: Record<string, unknown>
    schemas: Record<string, SchemaDefinition>
  }
  security: Array<Record<string, string[]>>
  paths: Record<string, unknown>
}

const spec: OpenApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BMI Socialite API',
    version: '3.0.0',
    description:
      'REST API untuk aplikasi BMI Socialite (web & React Native/Expo).\n\n' +
      '**Auth:** semua endpoint memakai `Authorization: Bearer <token>` (JWT HS256, 7 hari).\n\n' +
      '**Role:** `admin` > `manager` > `operator`. Setiap endpoint mencantumkan role minimum yang dibutuhkan.\n\n' +
      '**Upload flow:** upload screenshot dulu via `POST /mobile/upload`, lalu gunakan `id` media yang dikembalikan saat create/update post.',
  },
  servers: [{ url: '/api', description: 'Server aktif' }],
  tags: [
    { name: 'Auth', description: 'Login dan sesi pengguna' },
    { name: 'Posts', description: 'CRUD laporan media sosial' },
    { name: 'Upload', description: 'Upload screenshot ke S3' },
    { name: 'Dashboard', description: 'Statistik dan rekapitulasi (admin/manager)' },
    { name: 'Reference', description: 'Data referensi: kategori, provinsi, kota' },
    { name: 'Users', description: 'Manajemen user (admin only)' },
    { name: 'Tenants', description: 'Manajemen tenant (admin only)' },
    { name: 'Operators', description: 'Manajemen operator di tenant (admin/manager)' },
    { name: 'Settings', description: 'Pengaturan keamanan dan log akses (admin only)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT HS256, valid 7 hari. Dapatkan dari `POST /mobile/auth/login`.',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sid',
        description: 'Session cookie web untuk endpoint `/upload`.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Token tidak valid atau sudah kadaluarsa' },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          errors: {
            type: 'object',
            additionalProperties: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
              ],
            },
            example: {
              category_id: 'Kategori wajib dipilih.',
              title: 'Link upload tidak boleh kosong.',
            },
          },
        },
      },
      DuplicateError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Double entry terdeteksi!' },
          duplicate: { type: 'boolean', example: true },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '42' },
          name: { type: 'string', example: 'Budi Santoso' },
          email: { type: 'string', format: 'email', example: 'budi@example.com' },
          phone_number: { type: 'string', nullable: true, example: '082334200020' },
          is_admin: { type: 'boolean', example: false },
          roles: {
            type: 'array',
            items: { type: 'string' },
            example: ['operator'],
          },
        },
      },
      TenantContext: {
        type: 'object',
        nullable: true,
        properties: {
          id: { type: 'string', example: '7' },
          name: { type: 'string', example: 'BMI Jakarta Selatan' },
          city: { type: 'string', nullable: true, example: 'Jakarta Selatan' },
          province: { type: 'string', nullable: true, example: 'DKI Jakarta' },
          role: { type: 'string', nullable: true, example: 'operator' },
        },
      },
      CurrentUser: {
        allOf: [
          { $ref: '#/components/schemas/User' },
          {
            type: 'object',
            properties: {
              tenant: { $ref: '#/components/schemas/TenantContext' },
            },
          },
        ],
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'budi@example.com' },
          password: { type: 'string', example: 'secret' },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '3' },
          name: { type: 'string', example: 'Instagram' },
        },
      },
      Province: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 33 },
          name: { type: 'string', example: 'Jawa Tengah' },
        },
      },
      City: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '3374' },
          name: { type: 'string', example: 'Kota Semarang' },
        },
      },
      UploadedMedia: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '88' },
          uuid: { type: 'string', nullable: true, example: 'f7d5f5d0-7ac0-4c52-8a57-8d1a9b2d7d8e' },
          fileName: { type: 'string', example: 'blog-images-8f9c1c4c0d8a7d4b.png' },
          url: { type: 'string', format: 'uri', example: 'https://cdn.example.com/88/blog-images-8f9c1c4c0d8a7d4b.png' },
        },
      },
      PostUser: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '42' },
          name: { type: 'string', example: 'Budi Santoso' },
        },
      },
      Thumbnail: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '88' },
          uuid: { type: 'string', nullable: true },
          file_name: { type: 'string', example: 'blog-images-8f9c1c4c0d8a7d4b.png' },
          url: { type: 'string', format: 'uri' },
        },
      },
      Post: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '101' },
          title: { type: 'string', nullable: true },
          slug: { type: 'string', nullable: true },
          body: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['pending', 'valid', 'invalid'] },
          is_published: { type: 'boolean' },
          published_at: { type: 'string', format: 'date-time', nullable: true },
          blog_post_category_id: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time', nullable: true },
          source_url: {
            type: 'string',
            nullable: true,
            description: '"upload", "amplifikasi", atau null untuk laporan default',
          },
          province: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true },
          category: { nullable: true, allOf: [{ $ref: '#/components/schemas/Category' }] },
          user: { nullable: true, allOf: [{ $ref: '#/components/schemas/PostUser' }] },
          thumbnail: { nullable: true, allOf: [{ $ref: '#/components/schemas/Thumbnail' }] },
        },
      },
      PostListResponse: {
        type: 'object',
        properties: {
          posts: { type: 'array', items: { $ref: '#/components/schemas/Post' } },
          total: { type: 'integer', example: 120 },
        },
      },
      CreatePostInput: {
        type: 'object',
        required: ['category_id'],
        properties: {
          category_id: { type: 'string', description: 'ID kategori (wajib)' },
          title: {
            type: 'string',
            description: 'Link upload. Wajib untuk default dan upload, opsional untuk amplifikasi.',
          },
          body: { type: 'string', description: 'Isi laporan' },
          description: { type: 'string' },
          is_published: { type: 'boolean', default: false },
          media_id: {
            type: 'string',
            description: 'ID media pending dari `/mobile/upload`. Media harus milik user pemilik token.',
          },
          post_type: {
            type: 'string',
            enum: ['upload', 'amplifikasi'],
            description: 'Kosongkan untuk laporan default.',
          },
        },
      },
      UpdatePostInput: {
        allOf: [
          { $ref: '#/components/schemas/CreatePostInput' },
          {
            type: 'object',
            properties: {
              old_media_id: {
                type: 'string',
                description: 'Legacy/opsional. Server tidak mempercayai ID bebas dari klien; media lama diambil dari post yang sedang diedit.',
              },
            },
          },
        ],
      },
      DashboardStats: {
        type: 'object',
        properties: {
          userCount: { type: 'integer', description: 'Jumlah pelapor (distinct user_id)' },
          postCount: { type: 'integer', description: 'Total laporan dalam scope filter' },
          verifiedCount: { type: 'integer', description: 'Jumlah pelapor yang seluruh laporannya valid' },
        },
      },
      ChartItem: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'integer' },
        },
      },
      ProvinceChartItem: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          posts: { type: 'integer' },
          operators: { type: 'integer' },
        },
      },
      CityChartGroup: {
        type: 'object',
        properties: {
          province: { type: 'string' },
          cities: { type: 'array', items: { $ref: '#/components/schemas/ProvinceChartItem' } },
        },
      },
      DashboardResponse: {
        type: 'object',
        properties: {
          stats: { $ref: '#/components/schemas/DashboardStats' },
          byProvince: { type: 'array', items: { $ref: '#/components/schemas/ChartItem' } },
          provinceChart: { type: 'array', items: { $ref: '#/components/schemas/ProvinceChartItem' } },
          topCities: { type: 'array', items: { $ref: '#/components/schemas/CityChartGroup' } },
          postsByDate: { type: 'array', items: { $ref: '#/components/schemas/ChartItem' } },
        },
      },
      DashboardReportRow: {
        type: 'object',
        additionalProperties: true,
      },
      UserRow: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '42' },
          name: { type: 'string', example: 'Budi Santoso' },
          email: { type: 'string', format: 'email' },
          phone_number: { type: 'string', nullable: true },
          is_blocked: { type: 'boolean' },
          is_admin: { type: 'boolean' },
          direct_role_id: { type: 'string', nullable: true },
          direct_role_name: { type: 'string', nullable: true },
          last_seen_at: { type: 'string', format: 'date-time', nullable: true },
          active_failed_attempts: { type: 'integer' },
          is_under_attack: { type: 'boolean' },
          is_rate_limited: { type: 'boolean' },
        },
      },
      UserListResponse: {
        type: 'object',
        properties: {
          users: { type: 'array', items: { $ref: '#/components/schemas/UserRow' } },
          total: { type: 'integer' },
          totalBlocked: { type: 'integer' },
          totalUnderAttack: { type: 'integer' },
          totalRateLimited: { type: 'integer' },
        },
      },
      CreateUserInput: {
        type: 'object',
        required: ['name', 'email', 'phone_number'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone_number: { type: 'string' },
          password: { type: 'string', description: 'Default: phone_number' },
          role_id: { type: 'string', description: 'ID role dari /mobile/users/roles' },
          is_admin: { type: 'boolean', default: false },
        },
      },
      BulkImportPreview: {
        type: 'object',
        properties: {
          rows: { type: 'array', items: { type: 'object', additionalProperties: true } },
          totalRows: { type: 'integer' },
          validRows: { type: 'integer' },
          duplicateExistingRows: { type: 'integer' },
          duplicateInputRows: { type: 'integer' },
          invalidRows: { type: 'integer' },
        },
      },
      BulkImportResult: {
        allOf: [
          { $ref: '#/components/schemas/BulkImportPreview' },
          {
            type: 'object',
            properties: {
              createdRows: { type: 'integer' },
              skippedRows: { type: 'integer' },
            },
          },
        ],
      },
      RoleOption: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '2' },
          name: { type: 'string', example: 'manager' },
        },
      },
      TenantRow: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          domain: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true },
          manager_count: { type: 'integer' },
          operator_count: { type: 'integer' },
        },
      },
      TenantDetail: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          domain: { type: 'string', nullable: true },
          address: {
            type: 'object',
            properties: {
              id: { type: 'string', nullable: true },
              address_line_1: { type: 'string', nullable: true },
              city: { type: 'string', nullable: true },
              state: { type: 'string', nullable: true },
              zip: { type: 'string', nullable: true },
              province_id: { type: 'integer', nullable: true },
              city_id: { type: 'integer', nullable: true },
            },
          },
        },
      },
      TenantUserRow: {
        type: 'object',
        properties: {
          tenant_user_id: { type: 'string' },
          user_id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', nullable: true },
        },
      },
      TenantFormInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          domain: { type: 'string' },
          address: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Wajib saat update jika address sudah ada' },
              address_line_1: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              zip: { type: 'string' },
              province_id: { type: 'integer' },
              city_id: { type: 'integer' },
            },
          },
        },
      },
      OperatorRow: {
        type: 'object',
        properties: {
          tenant_user_id: { type: 'string' },
          user_id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone_number: { type: 'string', nullable: true },
        },
      },
      SecuritySettings: {
        type: 'object',
        properties: {
          blockedIps: { type: 'array', items: { type: 'string' }, example: ['1.2.3.4'] },
          allowedCountries: { type: 'array', items: { type: 'string' }, example: ['ID'] },
          allowUnknownCountries: { type: 'boolean', default: true },
          apiEnabled: { type: 'boolean', default: true },
          maxUploadedFileSizeBytes: { type: 'integer', example: 5242880 },
          operatorReportingWindowEnabled: { type: 'boolean', default: false },
          operatorReportingWindowStart: { type: 'string', example: '08:00' },
          operatorReportingWindowEnd: { type: 'string', example: '21:00' },
          managerReportingWindowEnabled: { type: 'boolean', default: false },
          managerReportingWindowStart: { type: 'string', example: '08:00' },
          managerReportingWindowEnd: { type: 'string', example: '21:00' },
        },
      },
      AccessLogRow: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          event_type: { type: 'string' },
          request_path: { type: 'string', nullable: true },
          method: { type: 'string', nullable: true },
          status: { type: 'string' },
          ip: { type: 'string', nullable: true },
          country: { type: 'string', nullable: true },
          user_id: { type: 'string', nullable: true },
          user_email: { type: 'string', nullable: true },
          browser: { type: 'string', nullable: true },
          os: { type: 'string', nullable: true },
          device_type: { type: 'string', nullable: true },
          details: { type: 'object', nullable: true, additionalProperties: true },
        },
      },
      AccessLogsResponse: {
        type: 'object',
        properties: {
          rows: { type: 'array', items: { $ref: '#/components/schemas/AccessLogRow' } },
          total: { type: 'integer' },
          logsEnabled: { type: 'boolean' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/mobile/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login — dapatkan JWT',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login berhasil',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          '400': {
            description: 'Input tidak lengkap',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Kredensial salah',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '403': {
            description: 'Akun diblokir',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Data user yang sedang login',
        responses: {
          '200': {
            description: 'Data user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CurrentUser' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/upload': {
      post: {
        tags: ['Upload'],
        summary: 'Upload screenshot ke S3 (JWT)',
        description: 'Upload dulu, simpan `id` yang dikembalikan, lalu gunakan sebagai `media_id` saat create/update post. Server memvalidasi magic bytes file dan menandai media pending dengan pemilik token.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Gambar JPG/PNG/GIF/WebP',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upload berhasil',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UploadedMedia' },
              },
            },
          },
          '400': {
            description: 'File tidak valid atau terlalu besar',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/upload': {
      post: {
        tags: ['Upload'],
        summary: 'Upload screenshot ke S3 (cookie session — web only)',
        description: 'Digunakan oleh form web. Memerlukan cookie session `sid`, bukan JWT.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upload berhasil',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UploadedMedia' },
              },
            },
          },
          '400': {
            description: 'File tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '500': {
            description: 'Gagal upload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/posts': {
      get: {
        tags: ['Posts'],
        summary: 'List laporan',
        description: 'Operator hanya melihat laporan miliknya. Manager otomatis dibatasi ke tenant miliknya. Admin bisa filter by `userId` atau `tenantId`.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'valid', 'invalid'] }, description: 'Filter status laporan' },
          { name: 'postType', in: 'query', schema: { type: 'string', enum: ['upload', 'amplifikasi'] } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Admin atau manager dalam tenant yang sama' },
          { name: 'tenantId', in: 'query', schema: { type: 'string' }, description: 'Admin bebas; manager hanya tenant miliknya' },
        ],
        responses: {
          '200': {
            description: 'List + total',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PostListResponse' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Posts'],
        summary: 'Buat laporan baru',
        description:
          'Upload screenshot terlebih dahulu via `/mobile/upload`, lalu kirim `media_id` milik token yang sama.\n\n' +
          '- **upload**: wajib `title` (URL), `media_id` opsional\n' +
          '- **amplifikasi**: `title` opsional, `media_id` wajib\n' +
          '- **default** (tanpa `post_type`): wajib `title` dan `media_id`\n\n' +
          'Double entry per kategori per hari hanya berlaku untuk `upload` dan default. `amplifikasi` boleh dibuat lebih dari satu kali pada tanggal dan kategori media sosial yang sama.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePostInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Post dibuat',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IdResponse' },
              },
            },
          },
          '409': {
            description: 'Double entry hari ini untuk upload/default',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DuplicateError' },
              },
            },
          },
          '422': {
            description: 'Validasi gagal',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
              },
            },
          },
          '403': {
            description: 'Role tidak diizinkan',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/posts/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      get: {
        tags: ['Posts'],
        summary: 'Detail laporan',
        responses: {
          '200': {
            description: 'Data post lengkap',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Post' },
              },
            },
          },
          '404': {
            description: 'Tidak ditemukan',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Posts'],
        summary: 'Edit laporan',
        description: 'Operator hanya bisa edit miliknya sendiri. Manager tidak bisa edit.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePostInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Berhasil diupdate',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '403': {
            description: 'Akses ditolak',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '404': {
            description: 'Tidak ditemukan',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '422': {
            description: 'Validasi gagal',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Hapus laporan (admin only)',
        description: 'Menghapus post beserta media di S3.',
        responses: {
          '200': {
            description: 'Berhasil dihapus',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '403': {
            description: 'Hanya admin',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '404': {
            description: 'Tidak ditemukan',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/posts/{id}/status': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      patch: {
        tags: ['Posts'],
        summary: 'Ubah status laporan (admin/manager)',
        description: 'Admin dapat mengubah semua status. Manager hanya dapat mengubah status laporan tenant miliknya dan tunduk pada jam validasi manager.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['pending', 'valid', 'invalid'] },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Status berhasil diubah',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Status tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '403': {
            description: 'Hanya admin/manager',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '404': {
            description: 'Tidak ditemukan',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/posts/bulk-delete': {
      post: {
        tags: ['Posts'],
        summary: 'Hapus banyak laporan sekaligus (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ids'],
                properties: {
                  ids: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['101', '102', '103'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Berhasil dihapus',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeleteResponse' },
              },
            },
          },
          '400': {
            description: 'ids kosong atau bukan array',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '403': {
            description: 'Hanya admin',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Statistik dan chart dashboard (admin/manager)',
        description: 'Manager otomatis di-scope ke tenant miliknya.',
        parameters: [
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'provinceId', in: 'query', schema: { type: 'string' } },
          { name: 'cityId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['valid', 'invalid'] }, description: 'Filter status laporan' },
          { name: 'tenantId', in: 'query', schema: { type: 'string' }, description: 'Admin only' },
        ],
        responses: {
          '200': {
            description: 'Data dashboard',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardResponse' },
              },
            },
          },
          '403': {
            description: 'Hanya admin/manager',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/dashboard/report': {
      get: {
        tags: ['Dashboard'],
        summary: 'Rekapitulasi pelaporan (admin/manager)',
        parameters: [
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'provinceId', in: 'query', schema: { type: 'string' } },
          { name: 'cityId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['valid', 'invalid'] }, description: 'Filter status laporan' },
          { name: 'tenantId', in: 'query', schema: { type: 'string' }, description: 'Admin only' },
        ],
        responses: {
          '200': {
            description: 'Array baris rekapitulasi dari view `v_rekapitulasi_pelaporan`',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DashboardReportRow' },
                },
              },
            },
          },
          '403': {
            description: 'Hanya admin/manager',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/categories': {
      get: {
        tags: ['Reference'],
        summary: 'List kategori laporan',
        responses: {
          '200': {
            description: 'Array kategori',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Category' },
                },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/provinces': {
      get: {
        tags: ['Reference'],
        summary: 'List provinsi',
        responses: {
          '200': {
            description: 'Array provinsi',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Province' },
                },
              },
            },
          },
          '401': {
            description: 'Token tidak valid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/mobile/cities': {
      get: {
        tags: ['Reference'],
        summary: 'List kota/kabupaten',
        parameters: [
          { name: 'provinceId', in: 'query', schema: { type: 'string' }, description: 'Filter by ID provinsi (opsional)' },
        ],
        responses: {
          '200': {
            description: 'Array kota',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/City' } } } },
          },
          '401': { description: 'Token tidak valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── Users ────────────────────────────────────────────────────────────────
    '/mobile/users': {
      get: {
        tags: ['Users'],
        summary: 'List user dengan info keamanan (admin)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'blocked'] } },
          { name: 'loginSecurity', in: 'query', schema: { type: 'string', enum: ['has_attempts', 'under_attack', 'rate_limited'] } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['name', 'email', 'is_blocked', 'last_seen_at'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          '200': { description: 'List user', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserListResponse' } } } },
          '401': { description: 'Token tidak valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Buat user baru (admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserInput' } } } },
        responses: {
          '201': { description: 'User dibuat', content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } } },
          '409': { description: 'Email sudah terdaftar', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '422': { description: 'Validasi gagal', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/users/roles': {
      get: {
        tags: ['Users'],
        summary: 'List role untuk form user (admin)',
        responses: {
          '200': { description: 'Array role', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RoleOption' } } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/users/bulk-block': {
      post: {
        tags: ['Users'],
        summary: 'Block/unblock banyak user sekaligus (admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object', required: ['ids', 'block'],
                properties: {
                  ids: { type: 'array', items: { type: 'string' }, example: ['1', '2'] },
                  block: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Jumlah user diupdate', content: { 'application/json': { schema: { type: 'object', properties: { count: { type: 'integer' } } } } } },
          '400': { description: 'Input tidak valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/users/bulk-reset-rate-limit': {
      post: {
        tags: ['Users'],
        summary: 'Reset rate limit banyak user sekaligus (admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object', required: ['emails'],
                properties: { emails: { type: 'array', items: { type: 'string', format: 'email' } } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Jumlah email direset', content: { 'application/json': { schema: { type: 'object', properties: { count: { type: 'integer' } } } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/users/bulk-import/preview': {
      post: {
        tags: ['Users'],
        summary: 'Preview bulk import user dari teks (admin)',
        description: 'Format tiap baris: `Nama\\t08xx...` atau `Nama 08xx...`',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } },
        },
        responses: {
          '200': { description: 'Preview hasil parsing', content: { 'application/json': { schema: { $ref: '#/components/schemas/BulkImportPreview' } } } },
          '400': { description: 'Input tidak valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/users/bulk-import': {
      post: {
        tags: ['Users'],
        summary: 'Eksekusi bulk import user (admin)',
        description: 'Lakukan preview terlebih dahulu via `/mobile/users/bulk-import/preview`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } },
        },
        responses: {
          '200': { description: 'Hasil import', content: { 'application/json': { schema: { $ref: '#/components/schemas/BulkImportResult' } } } },
          '400': { description: 'Input tidak valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/users/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Users'],
        summary: 'Detail user (admin)',
        responses: {
          '200': { description: 'Data user', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserRow' } } } },
          '404': { description: 'Tidak ditemukan', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update user (admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserInput' } } } },
        responses: {
          '200': { description: 'Berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '409': { description: 'Email duplikat', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '422': { description: 'Validasi gagal', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/users/{id}/block': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      patch: {
        tags: ['Users'],
        summary: 'Block/unblock user (admin)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['block'], properties: { block: { type: 'boolean' } } } } },
        },
        responses: {
          '200': { description: 'Berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/users/{id}/rate-limit': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      delete: {
        tags: ['Users'],
        summary: 'Reset rate limit user (admin)',
        responses: {
          '200': { description: 'Berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '404': { description: 'User tidak ditemukan', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── Tenants ──────────────────────────────────────────────────────────────
    '/mobile/tenants': {
      get: {
        tags: ['Tenants'],
        summary: 'List tenant (admin)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'cityId', in: 'query', schema: { type: 'string' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['name', 'city', 'manager_count', 'operator_count'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          '200': {
            description: 'List tenant',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tenants: { type: 'array', items: { $ref: '#/components/schemas/TenantRow' } },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        tags: ['Tenants'],
        summary: 'Buat tenant baru (admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TenantFormInput' } } } },
        responses: {
          '201': { description: 'Tenant dibuat', content: { 'application/json': { schema: { $ref: '#/components/schemas/IdResponse' } } } },
          '409': { description: 'Domain duplikat', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '422': { description: 'Validasi gagal', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/tenants/search-users': {
      get: {
        tags: ['Tenants'],
        summary: 'Cari user yang bisa ditambahkan ke tenant (admin)',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Min 2 karakter' },
          { name: 'tenantId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Array user yang cocok',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } } },
                },
              },
            },
          },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/tenants/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Tenants'],
        summary: 'Detail tenant (admin)',
        responses: {
          '200': { description: 'Data tenant', content: { 'application/json': { schema: { $ref: '#/components/schemas/TenantDetail' } } } },
          '404': { description: 'Tidak ditemukan', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      put: {
        tags: ['Tenants'],
        summary: 'Update tenant (admin)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TenantFormInput' } } } },
        responses: {
          '200': { description: 'Berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '404': { description: 'Tidak ditemukan', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      delete: {
        tags: ['Tenants'],
        summary: 'Hapus tenant (admin)',
        description: 'Gagal jika tenant masih memiliki manager/operator.',
        responses: {
          '200': { description: 'Berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '409': { description: 'Tenant masih memiliki user', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/tenants/{id}/users': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Tenants'],
        summary: 'List user dalam tenant (admin)',
        responses: {
          '200': {
            description: 'Array tenant user',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TenantUserRow' } } } },
          },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        tags: ['Tenants'],
        summary: 'Tambahkan user ke tenant (admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object', required: ['user_id', 'role'],
                properties: {
                  user_id: { type: 'string' },
                  role: { type: 'string', enum: ['manager', 'operator'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User ditambahkan', content: { 'application/json': { schema: { type: 'object', properties: { tenant_user_id: { type: 'string' } } } } } },
          '409': { description: 'User sudah di tenant', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/tenants/{id}/users/{tenantUserId}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'tenantUserId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      delete: {
        tags: ['Tenants'],
        summary: 'Hapus user dari tenant (admin)',
        responses: {
          '200': { description: 'Berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/tenants/{id}/users/{tenantUserId}/role': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'tenantUserId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      patch: {
        tags: ['Tenants'],
        summary: 'Ubah role user di tenant (admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['manager', 'operator'] } } },
            },
          },
        },
        responses: {
          '200': { description: 'Berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/tenants/{id}/operators/import/preview': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Tenants'],
        summary: 'Preview bulk import operator ke tenant (admin)',
        description: 'Format: satu nomor HP per baris (08xx...)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } },
        },
        responses: {
          '200': { description: 'Preview hasil parsing', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/tenants/{id}/operators/import': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Tenants'],
        summary: 'Eksekusi bulk import operator ke tenant (admin)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } },
        },
        responses: {
          '200': { description: 'Hasil import', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── Operators ────────────────────────────────────────────────────────────
    '/mobile/operators': {
      get: {
        tags: ['Operators'],
        summary: 'List operator di tenant saya (admin/manager)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Filter nama' },
          { name: 'email', in: 'query', schema: { type: 'string' } },
          { name: 'phone', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'List operator',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    operators: { type: 'array', items: { $ref: '#/components/schemas/OperatorRow' } },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          '403': { description: 'Hanya admin/manager', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        tags: ['Operators'],
        summary: 'Tambahkan operator ke tenant saya (admin/manager)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['user_id'], properties: { user_id: { type: 'string' } } } } },
        },
        responses: {
          '201': { description: 'Operator ditambahkan', content: { 'application/json': { schema: { type: 'object', properties: { tenant_user_id: { type: 'string' } } } } } },
          '409': { description: 'User sudah di tenant', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Hanya admin/manager', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/operators/search': {
      get: {
        tags: ['Operators'],
        summary: 'Cari user untuk ditambahkan sebagai operator (admin/manager)',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Min 2 karakter' },
        ],
        responses: {
          '200': {
            description: 'Array user yang cocok',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } } },
                },
              },
            },
          },
          '403': { description: 'Hanya admin/manager', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/operators/{tenantUserId}': {
      parameters: [{ name: 'tenantUserId', in: 'path', required: true, schema: { type: 'string' } }],
      delete: {
        tags: ['Operators'],
        summary: 'Lepas operator dari tenant (admin/manager)',
        responses: {
          '200': { description: 'Berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { description: 'Hanya admin/manager', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── Settings ─────────────────────────────────────────────────────────────
    '/mobile/settings/security': {
      get: {
        tags: ['Settings'],
        summary: 'Ambil pengaturan keamanan (admin)',
        responses: {
          '200': { description: 'Security settings', content: { 'application/json': { schema: { $ref: '#/components/schemas/SecuritySettings' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      put: {
        tags: ['Settings'],
        summary: 'Simpan pengaturan keamanan (admin)',
        description: '⚠️ Tidak ada validasi lockout di endpoint ini — pastikan IP/negara Anda tidak terblokir sebelum menyimpan.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SecuritySettings' } } } },
        responses: {
          '200': { description: 'Settings tersimpan', content: { 'application/json': { schema: { $ref: '#/components/schemas/SecuritySettings' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/settings/logs': {
      get: {
        tags: ['Settings'],
        summary: 'List log akses (admin)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'eventType', in: 'query', schema: { type: 'string' } },
          { name: 'country', in: 'query', schema: { type: 'string' } },
          { name: 'path', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': { description: 'Log akses', content: { 'application/json': { schema: { $ref: '#/components/schemas/AccessLogsResponse' } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      delete: {
        tags: ['Settings'],
        summary: 'Hapus seluruh log akses (admin)',
        responses: {
          '200': { description: 'Jumlah baris dihapus', content: { 'application/json': { schema: { type: 'object', properties: { deleted: { type: 'integer' } } } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/mobile/settings/logs/toggle': {
      patch: {
        tags: ['Settings'],
        summary: 'Aktifkan/nonaktifkan logging akses (admin)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['enabled'], properties: { enabled: { type: 'boolean' } } } } },
        },
        responses: {
          '200': { description: 'Status logging', content: { 'application/json': { schema: { type: 'object', properties: { enabled: { type: 'boolean' } } } } } },
          '403': { description: 'Hanya admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
}

spec.components.schemas.SuccessResponse = successResponse
spec.components.schemas.IdResponse = idResponse
spec.components.schemas.DeleteResponse = deleteResponse

export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.roles.includes('admin')) return Response.json({ error: 'Forbidden' }, { status: 403 })
  return Response.json(spec)
}
