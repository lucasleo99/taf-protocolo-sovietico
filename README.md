# TAF Protocolo Soviético - Sistema Inteligente

Sistema interativo para registro, acompanhamento, autorregulação e execução dos treinos do curso **TAF Protocolo Soviético (Gabriel Halabi)**.

---

## 🚀 Como Executar

### Opção 1: Direto no Navegador (Sem Instalação)
Basta dar dois cliques no arquivo `index.html` ou arrastá-lo para dentro do Google Chrome, Microsoft Edge ou Safari.

### Opção 2: Servidor Local (Para abrir no Celular na mesma rede Wi-Fi)
No terminal desta pasta, execute qualquer um dos comandos:

**Com Python:**
```bash
python -m http.server 3000
```

**Com Node.js:**
```bash
npx serve . -p 3000
```

Depois, acesse no navegador:
* No PC: `http://localhost:3000`
* No Celular (conectado ao mesmo Wi-Fi): `http://SEU_IP_LOCAL:3000` (ex: `http://192.168.1.15:3000`)

---

## ⚡ Principais Funcionalidades

1. **EMOM Live Timer Interativo:**
   * Bipes sonoros nos últimos 3 segundos de cada minuto.
   * Alerta sonoro e visual para a série do minuto (Barra, Abdominal ou Flexão).
   * Alerta de "Último Minuto Até a Falha" com cálculo automático de progressão para o próximo treino.
   * Tecla de atalho no computador: barra de espaço para marcar série concluída.

2. **Guia e Desmame da Barra Fixa com Elástico:**
   * Suporte para quem faz 0 ou 1 repetição livre.
   * Seletor de intensidade da Superband (Verde, Roxa, Vermelha, Livre ou Excêntrica).
   * Acompanhamento do desmame treino a treino.

3. **Integração Garmin & Frequência Cardíaca:**
   * Cálculo das Zonas 1 a 5 por **Tanaka + Karvonen** com 1 clique para copiar para o Garmin Connect.
   * Estrutura visual passo a passo dos treinos (Ficha A 20 min, B1 Tiros Curtos 52 min, B2 Tiros Longos 52 min, C Trote Longo 40 min).

4. **Registro de Treinos da Assessoria de Corrida:**
   * Formulário dedicado para registrar os treinos prescritos pelo seu treinador da assessoria (Pace, FC Média, Tipo de Treino, Observações) sem misturar com o protocolo padrão.

5. **Diário de Treinos 100% Automático:**
   * Zero copiar e colar.
   * Exportação para arquivo Excel (.CSV) com acentuação correta (UTF-8 com BOM).
   * Backup e restauração em JSON.
