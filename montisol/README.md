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
