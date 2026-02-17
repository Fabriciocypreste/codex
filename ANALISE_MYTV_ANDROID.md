# Análise: mytv-android — o que serve para o REDX

**Repositório:** [mytv-android/mytv-android](https://github.com/mytv-android/mytv-android)  
**Descrição:** Player IPTV para Android/Android TV, estilo Material 3 Expressive, com Media3, IJKplayer e VLC.

---

## 1. Código-fonte não é público

O README informa que **o projeto não publica mais o código-fonte**:

> *"由于项目开源引来大量的分发... 项目目前将不再公开源代码。"*  
> (Devido à distribuição em massa gerada pelo open source, o projeto **não disponibiliza mais o código-fonte**.)

No repositório público só existem:

- `.github` (workflows/CI)
- `README.md` / `README_EN.md`
- `LICENSE_ORIGIN`, `LICENSE_PART1`
- `img/` (imagens)

**Não há** `app/`, `src/`, módulos Kotlin/Java ou qualquer implementação que possamos copiar ou reutilizar diretamente.

---

## 2. O que podemos aproveitar (documentação / UX)

O README descreve o **mapeamento de controle remoto e toque**, alinhado com apps de TV. Podemos usar isso como **referência de UX** no REDX.

### 2.1 Mapeamento de controle remoto (mytv-android)

| Ação           | Controle remoto        | Toque / gesto   |
|----------------|------------------------|------------------|
| Trocar canal   | Setas ↑↓ ou teclas numéricas | Swipe vertical   |
| Selecionar     | OK                     | Toque            |
| Trocar linha   | Setas ←→               | Swipe horizontal |
| Configurações  | Menu / Ajuda ou **long-press OK** | Duplo toque / long-press |

### 2.2 Comparação com o REDX

| Recurso              | mytv-android (doc) | REDX (atual) |
|----------------------|--------------------|--------------|
| Setas ↑↓←→           | Sim (canais/linhas)| Sim (navegação espacial) |
| OK / Enter           | Sim (selecionar)   | Sim (selecionar / play)  |
| Back                 | Implícito          | Sim (Escape injetado)    |
| Long-press OK        | Abre configurações | Não                         |
| Teclas numéricas     | Troca de canal     | Não (não há lista de canais numérica) |
| Swipe = setas        | Sim                | Não (app é foco/teclado)  |

Conclusão: o REDX já cobre **setas + OK + Back**. O que podemos **adotar como ideia** é:

- **Long-press OK** para abrir um menu (ex.: Configurações ou atalhos) na TV Box, se no futuro quiser um atalho sem precisar navegar até “Settings”.
- **Teclas numéricas**: só faria sentido se tiver lista de canais/filmes numerada (ex.: 1–9 para pular para o item 1–9 da row).

---

## 3. Projetos irmãos (fontes / EPG)

O mytv-android cita projetos de **conteúdo** e **configuração**, não de app:

- [BRTV-Live-M3U8](https://github.com/mytv-android/BRTV-Live-M3U8) – fontes M3U
- [China-TV-Live-M3U8](https://github.com/mytv-android/China-TV-Live-M3U8) – fontes M3U
- [myEPG](https://github.com/mytv-android/myEPG) – programa de canais (EPG)
- [myTVlogo](https://github.com/mytv-android/myTVlogo) – logos de canais
- [mytvJS](https://github.com/mytv-android/mytvJS) – fontes JS
- [myMIGU](https://github.com/mytv-android/myMIGU) – fontes Migu

Para o REDX:

- **EPG**: se tiver guia de programação (ex.: Live TV), o conceito do myEPG pode inspirar modelo de dados ou UI, mas não há código do mytv-android para reutilizar.
- **M3U/lista de canais**: seu backend/Supabase já gerencia catálogo; esses repositórios são mais úteis como referência de formato (M3U/M3U8) ou de listas de exemplo.

---

## 4. Base que eles usam (se quiser estudar código nativo)

O mytv-android declara ser baseado em:

- **天光云影 (Tianguang Yunying):** [yaoxieyoulei/mytv-android, branch `feature/ui`](https://github.com/yaoxieyoulei/mytv-android/tree/feature/ui)
- **BV:** [aaa1115910/bv](https://github.com/aaa1115910/bv)

Esses sim podem ter **código aberto** (Kotlin/Java, tratamento de D-pad, Media3/ExoPlayer, etc.). Se no futuro você quiser referência de **app Android TV nativo** (não WebView), vale olhar esses repositórios, não o mytv-android atual (que não expõe código).

---

## 5. Resumo: o que “serve” para a gente

| Item                         | Ação sugerida |
|-----------------------------|----------------|
| Código do mytv-android      | **Não há** código público para reutilizar. |
| Mapeamento remoto (README)  | **Usar como referência UX**: manter setas + OK + Back; considerar **long-press OK** para menu/atalho no futuro. |
| Teclas numéricas            | Opcional: em telas com lista/row, 1–9 = pular para item 1–9 (como no plano do Jellyfin). |
| Projetos irmãos (M3U, EPG)  | Referência de **formato** e **dados** (listas, EPG), não de implementação do REDX. |
| Tianguang Yunying / BV      | Possível referência de **código nativo** Android TV (D-pad, player), se quiser comparar com abordagem nativa. |

**Conclusão:** do repositório [mytv-android/mytv-android](https://github.com/mytv-android/mytv-android) não dá para “puxar” código; só **padrões de uso de controle remoto e toque** descritos no README. O que já implementamos no REDX (D-pad injetado, Enter, Back, foco na primeira row ao trocar de página) já cobre o essencial. O único acréscimo sugerido pela análise do mytv-android é **long-press OK para menu/ configurações** e, se fizer sentido, **teclas numéricas** em listas/rows.
