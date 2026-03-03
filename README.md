# canvas

uma ferramenta visual pra mapear arquitetura de sistemas. a ideia é parecida com o n8n mas o foco é diferente — quero conseguir organizar visualmente como os sistemas de um ambiente se conectam, sem precisar de planilha ou draw.io.

ainda tá no começo mas já dá pra usar.

## o que tem até agora

- canvas com zoom e pan (botão do scroll pra arrastar, scroll pra zoom)
- nodes representando sistemas, com categoria e status
- conexões entre nodes arrastando de um handle pra outro
- botão direito no canvas pra adicionar sistema ou nota
- botão direito no node pra editar ou deletar
- notas adesivas colapsáveis direto no canvas
- seleção de área com botão esquerdo
- tudo salvo no localStorage, não perde nada ao recarregar

## rodando

```bash
npm install
npm run dev
```

abre em `http://localhost:5173`

## stack

- React + Vite
- React Flow (@xyflow/react)
- Tailwind CSS v4

## próximos passos

ainda tem muita coisa que quero adicionar. isso aqui é só a base visual.
