# Deadlock Stats

A lightweight, static website that displays live statistics for [Deadlock](https://store.steampowered.com/app/1422450/Deadlock/) by Valve — hero and item win rates, pick rates, and more — powered by the community-run [Deadlock API](https://api.deadlock-api.com).

Built with plain **HTML, CSS, and JavaScript** — no frameworks, no build step. Just clone and open.

🔗 **Live data source:** [api.deadlock-api.com](https://api.deadlock-api.com/docs)

---

## Features

- **Hero stats table** — win rate and pick rate for every hero, with icons, pulled live from the API.
- **Item stats table** — same stats for in-game items, correctly normalized for the fact that multiple players can buy the same item in a single match.
- **Sortable columns** — click "Win Rate" or "Pick Rate" to cycle through three states: highest → lowest → alphabetical (by name).
- **Tab navigation** — switch between Heroes and Items without reloading the page.
- **"Last updated" indicator** — shows the timestamp of the most recently processed match, so you know how fresh the data is.
- **Built-in translation system (i18n)** — all interface text is decoupled from the HTML via `data-i18n` attributes and JSON translation files, so contributors can add a new language by creating a single file, without touching HTML or JavaScript.
- **No backend required** — 100% static, deployable for free on GitHub Pages.
- **Open source** — contributions welcome, see below.

## Getting started

1. Clone this repository.
2. Open the project folder in a code editor (e.g. VS Code).
3. Serve it locally with any static server — e.g. the VS Code **Live Server** extension. (Opening `index.html` directly with `file://` will **not** work, since the browser blocks local `fetch` requests in that mode.)

## Contributing a translation

1. Copy `translations/en.json`.
2. Rename it to your language code (e.g. `es.json`, `pt-br.json`).
3. Translate the values — keep the keys exactly as they are.
4. Open a pull request.

## Tech stack

- Vanilla HTML / CSS / JavaScript (no frameworks, no build tools)
- [Deadlock API](https://api.deadlock-api.com) (community-run, open source)
- Hosted on GitHub Pages

## License

Open source — feel free to fork, use, and contribute.

---
---

# Deadlock Stats (Português)

Um site estático e leve que mostra estatísticas ao vivo do jogo [Deadlock](https://store.steampowered.com/app/1422450/Deadlock/), da Valve — win rate e pick rate de heróis e itens, entre outras informações — usando a [Deadlock API](https://api.deadlock-api.com), criada e mantida pela comunidade.

Construído com **HTML, CSS e JavaScript puro** — sem frameworks, sem build step. É só clonar e abrir.

🔗 **Fonte dos dados:** [api.deadlock-api.com](https://api.deadlock-api.com/docs)

---

## Funcionalidades

- **Tabela de estatísticas de heróis** — win rate e pick rate de cada herói, com ícones, buscados ao vivo direto da API.
- **Tabela de estatísticas de itens** — as mesmas estatísticas para itens do jogo, com o cálculo corretamente ajustado para o fato de que vários jogadores podem comprar o mesmo item numa única partida.
- **Colunas ordenáveis** — clique em "Win Rate" ou "Pick Rate" para alternar entre três estados: maior → menor → ordem alfabética (pelo nome).
- **Navegação por abas** — alterne entre Heróis e Itens sem recarregar a página.
- **Indicador de "última atualização"** — mostra o horário da partida mais recente processada, para você saber o quão atualizados estão os dados.
- **Sistema de tradução embutido (i18n)** — todo o texto da interface é separado do HTML através de atributos `data-i18n` e arquivos de tradução em JSON, permitindo que qualquer contribuidor adicione um novo idioma criando um único arquivo, sem precisar mexer em HTML ou JavaScript.
- **Sem backend** — 100% estático, com deploy gratuito no GitHub Pages.
- **Open source** — contribuições são bem-vindas, veja abaixo.

## Como rodar localmente

1. Clone este repositório.
2. Abra a pasta do projeto num editor de código (ex: VS Code).
3. Sirva os arquivos com algum servidor local estático — por exemplo, a extensão **Live Server** do VS Code. (Abrir o `index.html` diretamente via `file://` **não** vai funcionar, já que o navegador bloqueia requisições `fetch` locais nesse modo.)

## Como contribuir com uma tradução

1. Copie o arquivo `translations/en.json`.
2. Renomeie para o código do seu idioma (ex: `es.json`, `pt-br.json`).
3. Traduza os valores — mantenha as chaves exatamente como estão.
4. Abra um pull request.

## Stack utilizada

- HTML / CSS / JavaScript puro (sem frameworks, sem ferramentas de build)
- [Deadlock API](https://api.deadlock-api.com) (mantida pela comunidade, open source)
- Hospedado no GitHub Pages

## Licença

Projeto open source — sinta-se à vontade para fazer fork, usar e contribuir.
