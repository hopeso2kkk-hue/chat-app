# Krisp SDK (áudio limpo tipo Discord)

O app integra o **Krisp JS SDK oficial** para remoção de ruído/teclado/som de fundo
no microfone, o mesmo que o Discord usa.

## Como baixar

1. Crie uma conta gratuita em https://sdk.krisp.ai (ou https://krisp.ai/developers)
   e solicite a licença (trial/dev).
2. No portal, baixe o **Web Browser SDK** (JavaScript).
3. Extraia o conteúdo baixado **aqui dentro desta pasta**, preservando a estrutura.
   No final deve existir pelo menos:

   ```
   public/krisp/krispsdk.mjs          <- o SDK
   public/krisp/models/model_nc_mq.kef <- modelo de Noise Cancellation (>8kHz)
   public/krisp/models/model_8.kef     <- modelo 8kHz (opcional)
   ```

   Se os arquivos vierem com outros nomes, renomeie para os nomes acima
   (o código aponta para esses caminhos).

4. O código cai automaticamente no RNNoise (fallback) se o SDK não estiver
   presente ou falhar ao carregar, então o app nunca quebra.

## O que o código faz

- `useVoiceChannel.js` tenta carregar `/krisp/krispsdk.mjs` dinamicamente.
- Se `KrispSDK.isSupported()` e a inicialização funcionarem, o microfone passa
  pelo filtro de Noise Cancellation do Krisp e o áudio limpo vai para a call.
- Caso contrário, usa o RNNoise/browser como fallback.

## Deploy (Render)

Os arquivos ficam em `client/public/krisp`, então o Vite copia para o `dist`
e o Render serve normalmente. Commit os arquivos no git para o deploy pegar.
