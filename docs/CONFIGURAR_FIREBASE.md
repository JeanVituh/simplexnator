# Configurar o Firebase (contas e projetos na nuvem)

Recurso **opcional**. Sem estas configurações o Simplexnator funciona normalmente: todas as funções de cálculo, o histórico local e a importação/exportação continuam disponíveis, e a página **Conta** apenas informa que as contas não estão habilitadas.

O frontend usa apenas a configuração **pública** do app Web do Firebase. **Nunca** coloque senhas, chaves privadas (JSON de conta de serviço) ou credenciais administrativas no código ou nas variáveis `VITE_*`.

## 1. Criar o projeto

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto** (nome sugerido: `simplexnator`). O Google Analytics é dispensável.
2. Em **Configurações do projeto (engrenagem) → Geral → Seus apps**, clique em **Web (`</>`)**, dê um apelido (ex.: `simplexnator-web`) e **não** marque o Firebase Hosting (a hospedagem é na Vercel).
3. Copie os valores do objeto `firebaseConfig`: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.

## 2. Ativar o Authentication

1. **Build → Authentication → Vamos começar**.
2. Aba **Sign-in method** → **E-mail/senha** → ativar (deixe “Link por e-mail” desativado) → Salvar.
3. Aba **Settings → Authorized domains** (Domínios autorizados): adicione `simplexnator.vercel.app` (e qualquer domínio de pré-visualização da Vercel que queira usar). `localhost` já vem autorizado.
4. (Opcional) **Templates → Redefinição de senha**: personalize o texto do e-mail (o idioma do e-mail segue o idioma configurado pelo aplicativo, pt-BR).

## 3. Criar o Firestore

1. **Build → Firestore Database → Criar banco de dados**.
2. Escolha uma região próxima (ex.: `southamerica-east1`) e inicie em **modo de produção** (as regras abaixo substituem o padrão).

## 4. Publicar as regras de segurança

As regras estão em `firestore.rules` (raiz do repositório). Elas permitem que cada usuário autenticado leia e grave **somente** em `users/{seu uid}/projects/*`, validam a estrutura dos documentos e **negam todo o resto**.

**Pelo console:** Firestore Database → aba **Regras** → cole o conteúdo de `firestore.rules` → **Publicar**.

**Pela CLI (opcional):**
```bash
npm install -g firebase-tools
firebase login
firebase use --add            # escolha o projeto
firebase deploy --only firestore:rules
```
(`firebase.json` já aponta para `firestore.rules`.)

## 5. Variáveis de ambiente

Local — `frontend/.env` (copie de `frontend/.env.example`):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```
Reinicie `npm run dev` depois de editar o `.env`.

Vercel — **Project Settings → Environment Variables**: crie as mesmas seis variáveis (Production e, se quiser, Preview) e faça um novo deploy (as variáveis `VITE_*` são embutidas no build).

O Simplexnator considera o Firebase configurado quando `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` e `VITE_FIREBASE_APP_ID` existem.

## 6. Como os dados são guardados

Caminho: `users/{uid}/projects/{projectId}`. Campos: `name`, `problem` (modelo), `method`, `integer`, `resultJson` (resultados como texto JSON, porque o Firestore não aceita arrays dentro de arrays), `resultOmitted`, `schemaVersion`, `ownerId`, `createdAt`, `updatedAt`. Resultados com mais de ~900 mil caracteres não são gravados (limite de 1 MiB por documento); nesse caso o projeto guarda apenas o modelo e as configurações, e o aplicativo avisa o usuário.

## 7. Verificação manual recomendada (não automatizada)

As regras **não puderam ser executadas** no emulador durante o desenvolvimento; confirme-as no seu projeto:

1. Crie duas contas (A e B). Com A, salve um projeto. Com B, confirme que a lista está vazia.
2. No console, **Firestore → Regras → Simulador de regras**: simule `get` em `/databases/(default)/documents/users/UID_DE_A/projects/ID` autenticado como B → deve ser **negado**; como A → **permitido**; sem autenticação → **negado**.
3. Simule `get` em um caminho fora de `users/.../projects/...` → **negado**.
4. Teste recuperação de senha: **Entrar → Esqueci minha senha** com o e-mail de A e confira o recebimento (cheque o spam).
5. Feche e reabra o navegador: a sessão deve persistir.

## 8. Problemas comuns

- *“Falha de conexão”* ou botão sem efeito: verifique as variáveis, reinicie o servidor e confira o domínio em **Authorized domains**.
- *“Sem permissão para acessar este projeto”*: as regras não foram publicadas ou o usuário não é o dono.
- *A página Conta mostra “Contas indisponíveis nesta instalação”*: as variáveis `VITE_FIREBASE_*` obrigatórias não estão definidas no build.
- *Cobrança*: o plano gratuito (Spark) é suficiente para uso acadêmico; acompanhe os limites de leitura/escrita do Firestore.
