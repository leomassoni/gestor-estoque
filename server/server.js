const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')

loadEnvFile(path.join(__dirname, '.env'))

const prisma = new PrismaClient()
const app = express()
const port = Number(process.env.PORT || 4000)
const clientDistPath = path.resolve(__dirname, '..', 'dist')

app.use(cors())
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', async (_request, response) => {
  await prisma.$queryRaw`SELECT 1`
  response.json({ ok: true })
})

app.get('/api/bootstrap', async (_request, response) => {
  const [companies, establishments, products, memberships, stockMovements] = await Promise.all([
    prisma.company.count(),
    prisma.establishment.count(),
    prisma.product.count(),
    prisma.membership.count(),
    prisma.stockMovement.count(),
  ])

  response.json({
    app: 'gestor-estoque',
    mode: 'bootstrap',
    counts: {
      companies,
      establishments,
      products,
      memberships,
      stockMovements,
    },
  })
})

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))

  app.get(/^(?!\/api\/).*/, (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next()
      return
    }

    response.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Erro interno do servidor.' })
})

app.listen(port, () => {
  console.log(`Gestor de Estoque API em http://localhost:${port}`)
})

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const fileContents = fs.readFileSync(filePath, 'utf8')
  fileContents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) {
        return
      }

      const key = line.slice(0, separatorIndex).trim()
      const rawValue = line.slice(separatorIndex + 1).trim()
      const normalizedValue = rawValue.replace(/^"(.*)"$/, '$1')

      if (!process.env[key]) {
        process.env[key] = normalizedValue
      }
    })
}
