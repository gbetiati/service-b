Vamos criar um projeto, seguir as intruções:

Instruções de desenvolvimento — Backend SaaS de conteúdo com IA

1. Contexto do projeto

Desenvolver um backend SaaS multi-tenant para automatizar a criação, revisão, armazenamento, agendamento e publicação de vídeos em redes sociais.

O sistema deverá permitir que empresas cadastrem marcas, produtos e imagens reais. A partir dessas informações, a IA deverá gerar roteiros e vídeos, que passarão por um serviço independente de validação antes de serem publicados.

2. Stack tecnológica

NestJS
TypeScript
PostgreSQL
Prisma ORM
Redis
BullMQ
AWS S3 ou Cloudflare R2
FFmpeg
OCR
IA multimodal para análise visual
pgvector para embeddings

3. Regras arquiteturais obrigatórias

Organizar os módulos em três camadas:

Domain
Entidades.
Regras de negócio.
Interfaces de repositórios.
Contratos de serviços.

Application
Use Cases.
Application Services.
DTOs internos.
Orquestração dos fluxos.

Infra
Controllers.
Prisma Repositories.
Integrações externas.
Storage Providers.
BullMQ Processors.
Implementações de serviços externos.

Regras:

Não implementar regras de negócio nos controllers.
Não acessar Prisma diretamente nos Use Cases.
Utilizar injeção de dependência.
Não acoplar a aplicação a fornecedores externos.
Garantir isolamento multi-tenant através de companyId.
Não criar microsserviços desnecessariamente.
Preferir módulos independentes dentro da mesma aplicação NestJS.

Instruções de desenvolvimento — Backend SaaS de conteúdo com IA

1. Contexto do projeto
   Desenvolver um backend SaaS multi-tenant para automatizar a criação, revisão, armazenamento, agendamento e publicação de vídeos em redes sociais.

O sistema deverá permitir que empresas cadastrem marcas, produtos e imagens reais. A partir dessas informações, a IA deverá gerar roteiros e vídeos, que passarão por um serviço independente de validação antes de serem publicados. 2. Stack tecnológica

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- Redis
- BullMQ
- AWS S3 ou Cloudflare R2
- FFmpeg
- OCR
- IA multimodal para análise visual
- pgvector para embeddings

3. Regras arquiteturais obrigatórias
   Organizar os módulos em três camadas:

Domain

- Entidades.
- Regras de negócio.
- Interfaces de repositórios.
- Contratos de serviços.
  Application
- Use Cases.
- Application Services.
- DTOs internos.
- Orquestração dos fluxos.
  Infra
- Controllers.
- Prisma Repositories.
- Integrações externas.
- Storage Providers.
- BullMQ Processors.
- Implementações de serviços externos.
  Regras:
- Não implementar regras de negócio nos controllers.
- Não acessar Prisma diretamente nos Use Cases.
- Utilizar injeção de dependência.
- Não acoplar a aplicação a fornecedores externos.
- Garantir isolamento multi-tenant através de companyId.
- Não criar microsserviços desnecessariamente.
- Preferir módulos independentes dentro da mesma aplicação NestJS.

4. Fases de implementação
   FASE 1 — Fundação e cadastros
   Implementar:

- Companies.
- Campaing.
- CampaingRules.
- Products.
- ProductCategories.
- MediaAssets.
  Criar migrations Prisma, repositories, Use Cases, controllers e DTOs.

Implementar upload de imagens através de uma abstração StorageProvider.

Critérios de conclusão:

- Criar empresas.
- Cadastrar marcas.
- Cadastrar produtos.
- Associar imagens aos produtos.
- Garantir isolamento entre empresas.
- Testar operações principais.
  FASE 2 — Conteúdo e histórico
  Implementar:
- Content.
- ContentAsset.
- Histórico de conteúdos.
- Metadados editoriais.
  Criar Use Cases:
- CreateContent.
- UpdateContent.
- GetContentHistory.
- GetContentDetails.
  Preparar estrutura para embeddings e pgvector.

Critérios de conclusão:

- Criar conteúdos vinculados a marcas e produtos.
- Armazenar roteiros.
- Consultar histórico.
- Recuperar os conteúdos por empresa.
  FASE 3 — Geração de vídeos
  Criar o módulo VideoGeneration.

Implementar:

- VideoProvider.
- CreatomateProvider.
- GenerateVideo.
- RenderVideo.
- GetVideoGenerationStatus.
  A integração deve ser assíncrona.

Após a geração:

1. Obter o vídeo final.
2. Persistir no S3/R2.
3. Criar VideoAsset no PostgreSQL.
4. Atualizar o status do conteúdo.
   Não armazenar vídeos inteiros na memória do Node.js.
---
Tambem implementar um modulo socialAccount com schema
model SocialAccount {
id String @id @default(uuid())
companyId String
company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
platform SocialPlatform
accountHandle String
displayName String?
status SocialAccountStatus @default(ACTIVE)
metadata Json?
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

credentials SocialCredential[]
publications Publication[]

@@unique([companyId, platform, accountHandle])
@@map("social_accounts")
}
model SocialCredential {
id String @id @default(uuid())
companyId String
company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
socialAccountId String
socialAccount SocialAccount @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)
kind String
encryptedValue String
initializationVector String
expiresAt DateTime?
scopes Json?
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@index([socialAccountId, kind])
@@map("social_credentials")
}

quero tambem que crie um provider com @Injectable, gerenico para fazer a conexao com outra api como instagram. Implementar tambem os mecanismos e enpoints para que eu possa conectar meu instagram no sistema

em relacao a filas: quero somente uma fila, de agendamento (publication-schedule)

preciso tambem que crie as seguintes entidades DDD e schema respectivos (adicionar os campos padroes como createdAt, updatedAt, companyid, etc):
Entidade

Content
campaingId
campaing (Relation)
campaingRulesId
campaingRules (Relation)
aiScript
productId(relation)
products(relation)
status: ContentStatus

enum ContentStatus: {
    APPROVED
    REPROVED
    WAITING
    ERROR
}

ContentScheduled
Content (Relation)
ContentId
date    
status: ContentStatus

---

(CRIE UM SISTEMA DE LOGIN COM JWT TOKEN E UM GUARD NEST PARA ISSO, tambem garanta que dados como userId CompanyId sejam guardando em um CONTEXTO, para que possamos usar isso ao longo do projeto sem precisar passar esses dados sempre via parametro)
por enquanto fazer somente isso, seguir clean code, e clean architeture, bem como DDD. Evitar muitas quebras de linha para nao poluir o codigo.
