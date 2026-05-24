# Backup Database Harian

Backup PostgreSQL dijalankan dengan `pg_dump` melalui script:

```bash
scripts/backup/backup-postgres.sh
```

## Setup

1. Install dependency di server:

   ```bash
   sudo apt-get update
   sudo apt-get install -y postgresql-client gzip openssh-client
   ```

2. Buat konfigurasi backup:

   ```bash
   sudo cp scripts/backup/backup-postgres.env.example /etc/socialite-backup.env
   sudo chmod 600 /etc/socialite-backup.env
   ```

3. Edit `/etc/socialite-backup.env`, lalu isi minimal:

   ```env
   BACKUP_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
   BACKUP_LOCAL_DIR="/var/backups/socialite"
   BACKUP_RETENTION_DAYS="7"
   ```

4. Tes manual:

   ```bash
   BACKUP_ENV_FILE=/etc/socialite-backup.env ./scripts/backup/backup-postgres.sh
   ```

## Cron Jam 22:00

Tambahkan ini dengan `crontab -e`:

```cron
0 22 * * * cd /path/ke/Socialite && BACKUP_ENV_FILE=/etc/socialite-backup.env ./scripts/backup/backup-postgres.sh >> /var/log/socialite-db-backup.log 2>&1
```

Jika ingin mengirim backup ke server lain, isi `BACKUP_REMOTE_TARGET` di `/etc/socialite-backup.env`.

## Restore

```bash
gunzip -c socialite-HOST-YYYYMMDD-HHMMSS.sql.gz | psql "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```
