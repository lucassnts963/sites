# Montisol · Trabalho de campo

Site estático (GitHub Pages) com as ferramentas de campo do contrato **Trocador de Calor** (Montisol · Hydro Alunorte).
Sem servidor e sem login: tudo roda no navegador e os registros ficam **no aparelho** de quem lança.

Endereço depois de publicar: `https://lucassnts963.github.io/sites/montisol/`

## Estrutura

```
montisol/
├── index.html              portal das ferramentas do Montisol (cartões)
├── sw.js                   service worker: usa a internet quando há e o cache quando não há (planta sem sinal)
├── README.md               este arquivo
├── rdo/                    app "RDO de campo" PUBLICADO (gerado pelo build de rdo-app/; não editar à mão)
│   ├── index.html, manifest.webmanifest, icone.svg
│   └── assets/app.js, assets/app.css
├── rdo-app/                código-fonte do RDO (React + Vite)
│   ├── src/lib/            lógica pura: mensagens do WhatsApp, validação, efetivo, rascunho, armazenamento, mapa (SVG)
│   ├── src/telas/          Lançar (PPU e presença), Pesquisar, Histórico, Config
│   ├── src/componentes/    campos, busca de pessoas, editor do espelho
│   └── test/               testes (mensagens comparadas com a versão 0.1 em test/legado/) e teste no navegador
├── dados/                  dados em listas JSON, separados do código
│   ├── trocadores.json     TAGs e o desenho de cada uma
│   ├── efetivo.exemplo.json  exemplo (nomes fictícios) do formato do efetivo
│   └── efetivo.json        NÃO publicar: efetivo real (ver "Privacidade")
└── desenhos/               espelhos dos trocadores
    ├── catalogo.json       lista dos desenhos, status dos tubos e cores
    └── <tipo>/<tipo>--<variacao>.svg
```

Para um app novo, crie `montisol/<app>/` e acrescente um cartão em `montisol/index.html`.
O app novo reaproveita `dados/` e `desenhos/`.

## Desenhos dos trocadores

- Um SVG por **tipo + variação** (a variação muda a quantidade de tubos):
  `desenhos/<tipo>/<tipo>--<variacao>.svg`, tudo minúsculo, sem acento, palavras ligadas por hífen.
  Exemplos: `aquecedor-de-polpa--5-furos.svg`, `resfriamento-a-vacuo--6-colmeias.svg`, `trocador-horizontal-caustico--330-tubos.svg`.
- **Tubos** são `<circle>` com `data-tube="<número>"` (único no desenho). O que não tiver `data-tube` é desenho de fundo.
  Grupos `<g id="Colmeia 1">` (ou `Estágio 1A`) viram zonas do espelho.
- Acrescentou um SVG? Registre-o em `desenhos/catalogo.json` (`id`, `tipo`, `variacao`, `tubos`, `arquivo`).
- Associe a TAG ao desenho em `dados/trocadores.json`. A TAG que estiver lá já abre com o desenho certo.
- O SVG devolvido pelo encarregado traz `data-status` em cada tubo (`desobstruido`, `obstruido`, `tamponado`, `furado`)
  e, no `<svg>`, `data-trocador`, `data-data`, `data-resp`, `data-desobstruidos`, `data-desobstruidos-turno`.

| Desenho | Tubos | Observação |
|---|---|---|
| `aquecedor-de-polpa--5-furos` | 180 | 36 feixes × 5 tubos; id do tubo = estágio-feixe-tubo |
| `aquecedor-de-polpa--6-furos` | 216 | 36 feixes × 6 tubos |
| `resfriamento-a-vacuo--6-colmeias` | 894 | HE 41A-01A (6 colmeias) |
| `trocador-horizontal-caustico--330-tubos` | 330 | trocador horizontal cáustico; malha triangular |

## Efetivo e privacidade

- O repositório é **público** (GitHub Pages). O **efetivo real (nomes) não deve ser publicado**: `dados/efetivo.json` deve ficar fora do commit
  (por isso está no `.gitignore` deste diretório).
- No site fica só `dados/efetivo.exemplo.json`. O encarregado abre **Config › Importar efetivo** e carrega o `efetivo.json`
  que o planejamento enviar (WhatsApp, e-mail). O arquivo fica guardado no aparelho.
- Formato de `efetivo.json`: `{ "atualizado": "AAAA-MM-DD", "frentes": { "<FRENTE>": "ppu|extra|6x4" }, "colaboradores": [ { "nome", "funcao", "frente", "turno", "status", "encarregado", "supervisor" } ] }`.
  A modalidade do lançamento vem de `frentes`: o encarregado escolhido define a equipe e o tipo (PPU, extra ou 6x4).

## Como o app funciona

- **PPU:** um bloco por equipamento (TAG) com equipe que trabalhou, AQS, horários, produção, paradas (tempo calculado, resumo Hydro/Montisol),
  atividades e fotos. O **DDS** tem início e término e o app calcula o tempo. **Puxar anterior** copia o último apontamento da TAG. **Mapear espelho** abre o desenho para marcar os tubos
  e **Usar números do mapa** preenche a produção. Para devolver o mapa:
  **Enviar imagem** (PNG com as contagens, o WhatsApp mostra como foto), **Enviar arquivo** (documento `.html` com o SVG dentro, para o painel) ou **⬇ SVG** (baixa o arquivo).
  O WhatsApp não envia `.svg` (recebe como foto e não consegue abrir), por isso o SVG vai dentro do `.html`. O app importa de volta tanto `.svg` quanto `.html`.
- **Controle de produção (PPU):** os dados da **manutenção da TAG** (total de tubos e total obstruídos/escopo) são preenchidos uma vez,
  ficam no aparelho e voltam em todo lançamento seguinte (editáveis; "Nova manutenção" encerra a atual e limpa o espelho).
  Desobstruídos no turno, acumulado, pendentes e tamponados **vêm do mapeamento**: no turno contam só os tubos marcados neste lançamento.
  Sem mapa marcado, os números são digitados e o acumulado soma os turnos anteriores.
- **Turno a turno:** ao salvar/enviar, cada equipamento grava o registro do turno (data, turno, encarregado, desobstruídos, acumulado, pendentes).
  Aparece no equipamento e em Histórico › Turno a turno por TAG.
- **Passagem de turno:** **📤 Passar turno** gera um `.html` (abre no navegador com o espelho e a tabela de turnos) com os dados dentro;
  o próximo encarregado toca **📥 Receber passagem** (ou importa no editor do espelho) e o app junta tudo. Ver "Sincronização entre os turnos".
- **Presença no PPU:** a equipe do encarregado entra numa lista de presença (Presente, Falta, Férias, Afastado). Quem falta sai da equipe do equipamento,
  e a falta pede justificativa e **onde deveria estar** (TAG; já vem com a TAG em que a pessoa estava). Vai na mensagem: no bloco do equipamento e num bloco de presença no fim.
- **Fotos com legenda:** por equipamento (PPU) e por lançamento (extra/6x4), com Antes/Durante/Depois e legenda. Ficam no aparelho (IndexedDB; o backup JSON leva só os textos).
  Ao enviar, a legenda é gravada na foto (faixa embaixo com TAG, data, turno e encarregado) e vai também como texto. **📷** na barra envia todas as fotos do lançamento.
- **Lista de equipamentos:** Config › Importar lista (CSV do Excel com `tag; tipo; area; desenho; tubos`, ou JSON como `trocadores.json`; há um modelo CSV).
  Fica no aparelho e soma com `dados/trocadores.json`; a TAG escolhida preenche desenho, total de tubos, tipo e área.
- **Extra e 6x4:** ao escolher o encarregado, entra a equipe toda; cada pessoa recebe Presente, Falta, Férias ou Afastado.
  Falta exige justificativa ou o botão **Sem justificativa**. Extra tem campo de atividades e de OS executadas e canceladas.
- Dá para **adicionar gente de outra equipe** (busca pelo nome, marcada "outra equipe") e **gente sem cadastro ou de outro contrato**
  (digitando o nome e o contrato).
- **Lembrar que sou eu** guarda o encarregado no aparelho e já abre o lançamento com a equipe dele.
- **WhatsApp:** monta a mensagem no formato do relatório e abre o WhatsApp. Se a mensagem for longa demais para o link, copia o texto.
- **Pesquisar:** busca por colaborador (equipe, encarregado, supervisor e os apontamentos feitos naquele aparelho).
- **Sem sinal:** depois do primeiro acesso com internet, o app abre offline (rede primeiro, cache de reserva). Lançamentos e histórico são locais de qualquer forma.
- **Histórico:** local, com ver, editar, duplicar para hoje, backup e restauração em arquivo JSON.

## Mapa de tubos: modos Mover e Marcar (regra de segurança)

Marcação errada no espelho vira número errado no RDO, no WhatsApp e na base de medição. Por isso (`rdo-app/src/lib/gestos.js`, testado em `test/gestos.test.js` e no navegador):

- **O mapa sempre abre em ✋ Mover** e volta para Mover toda vez que é fechado e aberto de novo. Em Mover, **nenhum toque marca tubo**:
  toque simples, toque duplo, arrasto, pinça (dois dedos) ou mouse só navegam e dão zoom.
- **Só em ✏ Marcar o toque marca**, e o encarregado escolhe esse modo de propósito. Em Marcar: tocar num tubo aplica o pincel escolhido
  (tocar de novo com o mesmo pincel limpa); arrastar **começando num tubo** pinta os tubos por onde o dedo passa; arrastar começando fora
  dos tubos só navega; ao pôr o segundo dedo (pinça) a pintura começada é cancelada e a cor volta ao que estava salvo.
- O modo ativo fica numa faixa logo acima do desenho: azul-marinho "Mover: toque nos tubos desativado" ou amarela
  "Marcar: o toque marca o tubo como …" (com a cor do pincel), e no botão selecionado do par Mover/Marcar.
- **↶ Desfazer** desfaz a última marcação (e também a importação de um SVG).
- **Ações em massa pedem confirmação:** Importar SVG no mapa ("Substituir TODAS as marcações…", dá para desfazer), juntar uma passagem de turno
  (no mapa e em 📥 Receber passagem, com resumo de quem enviou e quantos tubos), Nova manutenção (limpa o espelho) e usar a marcação de um SVG do aparelho.

## Identidade visual

Segue a identidade da Montisol (`projects/montisol/assets/identidade-visual/tokens.json` no vault): azul marinho `#243185`, azul royal `#2542e6`,
azul claro `#758aff` e branco; títulos em Montserrat e corpo em Exo 2 (woff2 em `rdo-app/src/fontes`, licença OFL, servidos com o app para funcionar offline).
Tema claro com texto escuro (legível no sol) e botões de 48 px ou mais. Logos e ícones de linha em `marca/` (cópia dos arquivos oficiais, sem alteração);
ícone do PWA = logo vertical branco no quadrado azul royal (`marca/pwa-*.png`). Verde e vermelho só onde a cor é informação (presença, mapa dos tubos, WhatsApp).

## Envio para a base (n8n)

**Enviar para a base** (ao lado do WhatsApp) manda o lançamento estruturado para `POST https://n8n.elucas.dev/webhook/montisol-rdo`
(cabeçalhos `Content-Type: application/json` e `X-RDO-Chave`). O planejamento confere e aprova no n8n; a base de medição só recebe o aprovado.

- **Chave:** digitada uma vez em Ajustes › Envio para a base e guardada só no aparelho (o repositório é público; a chave não vai no código nem no backup).
  Sem chave, o botão avisa "Peça a chave de envio ao planejamento". **Testar envio** manda `{"versao":1,"teste":true}` e mostra a resposta.
- **Contrato v1** (`rdo-app/src/lib/contrato.js`, testado campo a campo em `test/contrato.test.js`): `versao`, `id` (uuid fixo do lançamento),
  `app_versao`, `enviado_em`, `lancamento{…}` e `texto_whatsapp`. Não vão as imagens das fotos (só momento e legenda). O que o app não sabe vai `null`:
  horas por pessoa (`hn`, `he65`, `he100`, `adn`), números de produção não preenchidos e momento da foto não marcado. `inicio`/`termino`: o informado no
  cabeçalho; no PPU, se vazio, o primeiro DDS e o último término dos equipamentos. `frente`: a frente do encarregado no efetivo.
- **Fila offline:** o lançamento entra na fila do aparelho (IndexedDB) e é enviado na hora se houver internet; senão vai ao abrir o app, ao voltar a
  conexão, ao voltar para a tela e a cada 90 s. Status por lançamento ("enviado em…", "na fila") no lançamento e no Histórico (que também tem **⬆ Base**).
- **Sem duplicar:** reenviar usa o mesmo `id`. A fila entrega **pelo menos uma vez** (se o envio for interrompido depois de chegar, o mesmo id pode chegar de novo):
  o fluxo do n8n **precisa deduplicar pelo `id`** e responder `200 {"ok":true,"duplicado":true}`; o app trata isso como enviado.
- **Respostas:**
  - `200 {"ok":true,"id":"…","status":"pendente"}` = enviado (aguarda aprovação).
  - `200 {"ok":true,…,"atualizado":true}` = reenvio do mesmo id enquanto pendente/rejeitado: o n8n atualizou. O app avisa "Correção recebida: aguarda a aprovação do planejamento" e marca como enviado.
  - `409 {"ok":false,"ja_aprovado":true,…}` = já aprovado/registrado. **Definitivo:** sai da fila, não tenta de novo; o lançamento e o Histórico mostram "aprovado · Já aprovado pelo planejamento. Procure o planejamento para alterar."
  - `200 {"ok":true,"duplicado":true}` também conta como enviado.
  - 401/403 = "chave recusada": continua na fila. Sem conexão, tempo esgotado ou outro erro: continua na fila com a mensagem.
- **CORS:** o app roda em `https://lucassnts963.github.io`; o webhook precisa responder ao preflight (`OPTIONS`) liberando essa origem e os cabeçalhos
  `Content-Type` e `X-RDO-Chave` (no nó Webhook do n8n: *Allowed Origins (CORS)*). Sem isso o navegador bloqueia e o lançamento fica na fila.
- Os testes do navegador apontam o app para um webhook local (chave `montisol-rdo:v1:base:url-teste` no localStorage, só nos testes).

## Sincronização entre os turnos (PPU: um encarregado por turno, cada um no seu celular)

O site é estático e cada celular guarda os seus dados. O que precisa ser igual nos 3 aparelhos é o **espelho** (status de cada tubo),
os **dados da manutenção** e o **histórico turno a turno**. O formato foi feito para juntar sem conflito:

- cada tubo guarda quando e em qual lançamento foi marcado; ao juntar, vale a marcação mais recente de cada tubo
  (com relógio lógico: um celular com hora atrasada não perde para marcações antigas). A ordem das passagens não importa e repetir não duplica;
- desobstruídos no turno = tubos verdes marcados naquele lançamento, então a passagem pode chegar antes ou depois sem mudar a produção de ninguém;
- manutenção: vale a edição mais recente; duas manutenções abertas da mesma TAG (abertas em celulares diferentes) viram uma;
- turnos: cada lançamento tem o seu registro (id fixo); juntar = unir as listas.

**Hoje (sem servidor):** o arquivo de passagem pelo grupo do WhatsApp. Funciona sem sinal na planta, mas depende de cada encarregado enviar e receber.

**Próximo passo (decisão do Lucas):** o mesmo formato sincronizando sozinho quando houver internet (fila no aparelho; envia e recebe ao abrir/salvar):

| Opção | Como | Prós | Contras |
|---|---|---|---|
| Google Planilha + Apps Script | o app manda os turnos e as marcações para um script publicado na conta Google; a planilha guarda | grátis, sem servidor para manter, a planilha já serve para conferir o BMM/medição | link do script funciona como senha; alguns segundos por envio |
| n8n na VPS (webhook) | dois webhooks (enviar/receber) guardando os registros | fica na infraestrutura do BeaconOS, integra com o vault/Telegram | precisa de endereço público com HTTPS e de manter a VPS no ar |
| Firebase/Supabase | banco com sincronização pronta | tempo real, offline pronto | mais uma conta/serviço e dependência no app |

Recomendação: **Google Planilha + Apps Script** (menor custo de manutenção e a planilha vira o histórico da medição).

## Mini app interno do BeaconOS (`rdo-beacon/`)

`npm run build:beacon` gera **`montisol/rdo-beacon/`**, uma pasta autossuficiente para rodar como mini app do BeaconOS
(isolado, origem "null"). O app é o mesmo: o que muda por alvo fica em `rdo-app/src/plataforma/` (`pages.js` × `beacon.js`),
escolhido no build pelo alias `#plataforma`. **O GitHub Pages (`rdo/`) continua igual e publicado em paralelo.**

- **Arquivos:** `index.html`, `app.js` (script clássico, num arquivo só), `app.css` (fontes Exo 2 e Montserrat embutidas) e `marca/`
  (logos e ícones). Caminhos relativos, sem service worker e sem manifest. Script de módulo, `crossorigin` e fontes por URL
  são pedidos em modo CORS e falhariam em origem "null"; por isso o script é clássico e as fontes vão dentro do CSS.
- **Dados embutidos:** catálogo de desenhos, os 4 SVG, a lista de TAGs e o **efetivo de exemplo** vão dentro do `app.js` (sem `fetch`).
  O efetivo real continua importado em Ajustes (`efetivo.json` do planejamento) e nunca entra no build nem no repositório.
- **Armazenamento:** sem IndexedDB. A fila de envio fica no `localStorage`; valores grandes são gravados comprimidos (LZ, marcador `\u0001z`).
  Fotos: só momento e legenda (as imagens não ficam no aparelho; vão pelo WhatsApp). Aviso na tela perto de ~4 MB dos ~5 MB do navegador,
  e "Sem espaço no aparelho para salvar." quando o navegador recusa. Se o `localStorage` estiver bloqueado, o app usa a memória e mostra
  "Armazenamento do aparelho bloqueado" (os dados só duram enquanto a tela estiver aberta).
- **Envio para a base:** igual ao Pages (contrato v1, fila com id fixo, 409 já aprovado, 401/403 chave recusada); `app_versao` termina em `-beacon`.
  O pedido sai com `Origin: null` (o n8n aceita).
- **Quando o ambiente bloqueia** compartilhar, baixar, copiar ou abrir janela:
  - WhatsApp: se a janela não abrir, copia a mensagem e avisa; se nem copiar, mostra o texto para copiar à mão.
  - Arquivos (passagem, mapa, backup): abre uma janela com as opções (baixar, copiar o conteúdo, copiar a passagem como texto).
  - **Passagem de turno como texto:** `📋 Copiar passagem` gera uma mensagem com o código `RDOP1:…` (JSON comprimido, poucos KB);
    quem recebe usa `📋 Colar passagem`. Funciona também no Pages.
- **Testes:** `npm run test:e2e:beacon` (gera a pasta e roda no Chromium: sandbox com CSP `sandbox allow-scripts allow-forms allow-modals allow-popups`,
  sem armazenamento e com o `localStorage` do BeaconOS simulado com cota de 5 MB, página comum sem IndexedDB, 360 px, fila e reenvio, nenhum pedido fora da pasta).

## Mexer no RDO

O código fica em `rdo-app/`; o GitHub Pages continua servindo arquivos estáticos (sem Actions), por isso o build é commitado em `rdo/`.

```
cd montisol/rdo-app
npm install
npm run dev          # http://localhost:5173/rdo/  (serve ../dados e ../desenhos)
npm test             # testes da lógica
npm run test:e2e     # build + teste no Chromium (CHROMIUM=/caminho se não for /usr/bin/chromium)
npm run build        # gera ../rdo — commite junto com o código
```

- Os dados no aparelho usam as mesmas chaves da versão 0.1 (`montisol-rdo:v1:*`): rascunho, histórico, mapas e efetivo importado continuam lá depois de atualizar.
- O texto das mensagens do WhatsApp é comparado com o da versão 0.1 nos testes; se mudar o formato de propósito, ajuste `test/mensagens.test.js`.
- Mudou a lista de arquivos do build? Atualize `BASE` e a versão do cache em `sw.js`.

## Publicar

```
git add montisol index.html
git commit -m "Montisol: RDO de campo"
git push
```

No GitHub: Settings › Pages › Branch `master` (ou a usada) › `/ (root)`. Os dados do app (`localStorage`) são por endereço e por aparelho.

## Próximos passos possíveis

- Painel que leia os SVGs devolvidos e some a produção por trocador.
- Mais tipos de trocador em `desenhos/` (um SVG por variação).
