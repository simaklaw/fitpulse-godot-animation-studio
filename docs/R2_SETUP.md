# R2 setup — fitpulse-studio-raw (с телефона)

Цель: бакет для **промежуточных** GLB (pack-anim, retarget, renders-intermediate).  
В git и в публичные артефакты CI эти файлы **не** попадают (правило 5 AGENTS.md).

## 1. Создать бакет (Cloudflare Dashboard, ~5 мин)

1. Открой [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**.
2. **Create bucket** → имя: `fitpulse-studio-raw`.
3. Location: Automatic (или ближайший EU).
4. **Create**.

Раскладка ключей (префиксы, не отдельные бакеты):

```
pack-anim/          # GLB после извлечения из .scn (T1)
retarget/           # GLB после Blender retarget (T3)
renders-intermediate/  # PNG-секвенции до ffmpeg (T4)
```

## 2. API-токен (S3-совместимый)

1. R2 → **Manage R2 API Tokens** → **Create API token**.
2. Permissions: **Object Read & Write** (только бакет `fitpulse-studio-raw`).
3. TTL: по желанию (или без срока на время проекта).
4. Сохрани сразу:
   - Access Key ID
   - Secret Access Key
   - Endpoint вида `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

Account ID — в правой панели Overview Cloudflare (или в URL endpoint).

## 3. GitHub Secrets (репозиторий студии)

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Значение |
|--------|----------|
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key |
| `R2_BUCKET` | `fitpulse-studio-raw` (опционально, можно захардкодить в workflow) |

**Никогда** не вставляй эти значения в issues, PR, чат или код.

## 4. Проверка с телефона (после первого CI)

1. Actions → нужный workflow → Artifacts **не** должны содержать `.glb` пака.
2. Dashboard R2 → бакет → объект `pack-anim/...` должен быть виден.
3. Публичный URL R2 по умолчанию **закрыт** — так и оставляем.

## 5. CI-шаблон загрузки (aws cli, S3-совместимый)

Пример шага (добавляется в extract/render workflows, не коммитить ключи):

```yaml
- name: Upload GLB to R2
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    AWS_DEFAULT_REGION: auto
  run: |
    aws s3 cp out/anim.glb \
      "s3://fitpulse-studio-raw/pack-anim/${{ github.sha }}/anim.glb" \
      --endpoint-url "https://${{ secrets.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com"
```

Нужен `aws` CLI на раннере (`pip install awscli` или `amazon/aws-cli` action).

## 6. Приёмка T0.4

- [ ] Бакет `fitpulse-studio-raw` существует.
- [ ] Три секрета `R2_*` в GitHub Actions secrets.
- [ ] Тестовый объект загружен workflow’ом и виден владельцу в дашборде.
- [ ] В git / public artifacts нет GLB пака.

После этого можно запускать T1.3 (загрузка извлечённых GLB).
