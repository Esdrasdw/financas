<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Financas Pro AI

## Rodar localmente

**Requisitos:** Node.js (>= 20)

1. Instale as dependencias: `npm install`
2. (Opcional) Crie um arquivo `.env.local` (nao vai para o Git) com:
   - `OPENAI_API_KEY=SUACHAVEAQUI` (para habilitar o Advisor/Insights com GPT-5 Nano)
   - `OPENAI_MODEL=gpt-5-nano` (padrao)
   - `JWT_SECRET=um-segredo-bem-grande` (recomendado)
   - `DATA_DIR=./data` (ou um caminho/volume persistente)
3. Inicie a API: `npm run server`
4. Em outro terminal, inicie o frontend: `npm run dev`

Credenciais de demonstracao: `demo@financas.com / 123456`

## Producao (local)

1. Build do frontend: `npm run build`
2. Suba o servidor (API + frontend): `npm start`
3. Acesse: `http://localhost:4000`

## Deploy no Railway

1. Suba o projeto para o Git e crie um novo projeto no Railway apontando para o repositorio.
2. Em **Variables**, configure:
   - `JWT_SECRET` (obrigatorio)
   - `OPENAI_API_KEY` (opcional, mas necessario para a IA)
   - `OPENAI_MODEL` (padrao `gpt-5-nano`)
   - `DATA_DIR=/data` (aponta para volume persistente)
3. Faca o deploy. O Railway injeta `PORT` automaticamente.
