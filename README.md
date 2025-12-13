<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Finanças Pro AI

## Rodar localmente

**Requisitos:** Node.js (>= 20)

1. Instale as dependências: `npm install`
2. (Opcional) Crie um arquivo `.env.local` (não vai para o Git) com:
   - `GEMINI_API_KEY=SUACHAVEAQUI` (para habilitar o Advisor/Insights)
   - `JWT_SECRET=um-segredo-bem-grande` (recomendado)
3. Inicie a API: `npm run server`
4. Em outro terminal, inicie o frontend: `npm run dev`

Credenciais de demonstração: `demo@financas.com / 123456`

## Produção (local)

1. Build do frontend: `npm run build`
2. Suba o servidor (API + frontend): `npm start`
3. Acesse: `http://localhost:4000`

## Deploy no Railway

1. Suba o projeto para o Git e crie um novo projeto no Railway apontando para o repositório.
2. Em **Variables**, configure:
   - `JWT_SECRET` (obrigatório)
   - `GEMINI_API_KEY` (opcional, mas necessário para a IA)
3. Faça o deploy. O Railway injeta `PORT` automaticamente.
