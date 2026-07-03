# Folhão Digital — Especificação Funcional
## Sistema de Gestão da Interconsulta Nefrológica — HC-UFTM

**Versão:** 1.2 (revisão final de Chatiane — pronta para implementação)
**Autores:** Fred (Frederico Rodrigues da Cunha Pereira) + Chatiane + Gemini + Claude
**Data:** Junho/2026

---

## 1. Visão Geral

### 1.1 Problema
A equipe de nefrologia do HC-UFTM (7 médicos) acompanha diariamente ~20 pacientes com Lesão Renal Aguda (LRA), Doença Renal Crônica Dialítica (DRC-D) e LRA sobreposta à DRC. O registro hoje é feito em folha física A3 ("folhão"), com problemas de:
- Logística de carregar/organizar folhas físicas
- Preenchimento inconsistente entre membros da equipe
- Ausência de visão compartilhada em tempo real
- Nenhum aproveitamento dos dados para fins de pesquisa

### 1.2 Objetivo
PWA (Progressive Web App) multiusuário, com atualização em tempo real, para:
- Organizar pacientes em acompanhamento ativo
- Padronizar registro de evoluções, exames, prescrição dialítica
- Sinalizar pendências e status de avaliação diária
- Gerar base estruturada para pesquisa científica futura

### 1.3 Não-objetivos
- **Não substitui o AGHU** (prontuário eletrônico institucional) — é uma ferramenta operacional complementar da equipe.
- **Não é offline-first** — pressupõe conexão à internet disponível.
- **Não integra com AGHU/Infolab no MVP** — fica como visão de futuro (Seção 9).
- **Sem gamificação** — completude de registro é garantida por campos obrigatórios estruturados, não por mecânicas de jogo.

---

## 2. Escopo de Acesso

- Acesso restrito aos **7 nefrologistas do HC-UFTM**. Sem acesso de residentes ou outras especialidades.
- Login individual por médico (rastreabilidade de autoria), mas **todos acessam o mesmo conteúdo** — não há visões segmentadas por "paciente meu vs. paciente de outro".
- Implementação via **Supabase Auth + RLS (Row Level Security)**: política simples — usuário autenticado pertencente ao grupo "nefrologia HC" tem acesso de leitura/escrita a todos os registros; qualquer outro usuário, acesso negado.

---

## 3. Ciclo de Vida do Paciente

### 3.1 Entrada
Paciente entra no sistema quando um médico de outra especialidade solicita interconsulta/avaliação nefrológica. O **médico plantonista no momento** cadastra manualmente (evita poluição de dados com pacientes que não são da nefrologia).

**Verificação de duplicidade (obrigatória, não depende do médico lembrar):** ao iniciar o cadastro, o sistema busca pelo RG hospitalar digitado. Se já existir um Paciente com aquele RG na base — mesmo sem acompanhamento ativo no momento —, o sistema **não permite criar um registro novo do zero**. Em vez disso, exibe "Paciente já cadastrado, com N acompanhamento(s) anterior(es)" e oferece reativar a ficha existente (nova Internação + novo Acompanhamento Nefrológico vinculados ao mesmo Paciente), reaproveitando automaticamente comorbidades e etiologia de DRC já registradas. Isso evita registros duplicados quando o colega que recebe a interconsulta não sabe que o paciente já foi visto pela equipe antes.

### 3.2 Saída
Paciente é removido da lista de acompanhamento ativo quando ocorre um dos motivos abaixo. **O plantonista do momento é responsável por dar baixa.**

Dois campos distintos são registrados — não devem ser confundidos, pois têm significados diferentes para análise clínica e científica (ex: paciente pode receber alta hospitalar e permanecer dependente de diálise):

**Motivo da Alta do Acompanhamento** (por que saiu da lista ativa):
- Alta hospitalar
- Alta da nefrologia
- Transferência
- Óbito

**Desfecho Renal** (qual foi o resultado clínico renal):
- Recuperação completa
- Recuperação parcial
- Dependente de diálise
- Evolução para DRC
- Óbito

### 3.3 Reinternação (paciente recorrente)
- **RG hospitalar é identificador único e estável do paciente.**
- Se um paciente já cadastrado retorna (nova internação), **reativa-se a ficha existente** — não se cria um registro do zero.
- **Tudo que foi anotado anteriormente persiste e fica visível como histórico** (evoluções, exames, diagnósticos de internações passadas), mesmo que a internação atual comece com situação/conduta em branco para reavaliação.

### 3.4 Modelo de dados — três entidades centrais

```
PACIENTE (permanente, identificado por RG hospitalar)
  └── INTERNAÇÃO (cada passagem pelo hospital)
        └── ACOMPANHAMENTO NEFROLÓGICO (relação nefro ↔ internação)
              ├── Evoluções (múltiplas por dia)
              ├── Exames (série temporal)
              ├── Prescrições de HD/diálise peritoneal
              ├── Pendências (efêmeras, somem ao resolver)
              └── Escore KDIGO (calculado)
```

---

## 4. Entidades de Dados (detalhado)

### 4.1 Paciente (permanente)
| Campo | Tipo | Observação |
|---|---|---|
| Nome | texto | |
| Registro HC (RG hospitalar) | texto, único | **chave de identificação** |
| Data de nascimento | data | |
| Sexo | categórico | |
| Comorbidades | multi-select | DM, HAS, AVC, HIV, Hepatopatia, DPOC, ICC, ICO, DAC, Fibrilação atrial, Cirrose, Doença autoimune, Neoplasia, Transplante renal, Transplante hepático — persiste entre internações |
| Etiologia da DRC (se houver) | categórico | Nefropatia diabética / Nefroesclerose hipertensiva / DRPAD / Glomerulopatia / Nefrite túbulo-intersticial / Obstrutiva / Indeterminada / Outras — persiste entre internações |
| Data provável de início da LRA | data, opcional | permite calcular tempo até recuperação, tempo até HD, e classificar LRA transitória (≤48h) vs. persistente (>48h–7 dias), conforme KDIGO 2026 (Seção 10) |
| Creatinina basal | numérico | **obrigatório** — base para cálculo consistente do KDIGO e análises futuras de recuperação renal |
| Data da creatinina basal | data | |
| Fonte da creatinina basal | categórico | Ambulatório / Internação anterior / Laboratório externo / Estimada |
| Observações gerais | texto livre | persiste entre internações |

> **Sem CPF** — não é necessário para o caso de uso e reduz superfície de dado sensível (decisão tomada considerando LGPD).

### 4.2 Internação
| Campo | Tipo | Observação |
|---|---|---|
| Data de admissão | data | |
| Setor atual | categórico (dropdown) | ver lista de setores em 4.2.1 |
| Enfermaria/Leito atual | texto/número (dropdown ou campo livre, depende do setor) | granularidade de **enfermaria**, não sub-leito (A-E etc.) — ver 4.2.1 |
| Status | categórico | internado / alta / óbito |

> **Mudança de setor/leito**: campo simples, sobrescrito a qualquer momento (edição comum, propaga em tempo real). **Não há rastreamento de histórico de movimentação** — só importa a localização atual.

#### 4.2.1 Setores do HC-UFTM (lista fornecida por Fred)
- UTI Geral
- UTI 2
- UTI Coronariana
- UTI Neo
- Pronto-Socorro (código / classificação interna)
- Enfermarias do Pronto-Socorro
- Enfermarias de Clínica Médica
- Cirurgia Geral
- Ortopedia
- GO (Ginecologia/Obstetrícia)
- Pediatria
- Onco-Hemato
- Neurologia
- UDIP
- Pronto-Socorro Pediátrico
- UTR
- RPA (Recuperação Pós-Anestésica, Bloco Cirúrgico)
- Berçário

> Granularidade: cadastra-se apenas o **número da enfermaria** (ex: "105"), não o sub-leito (A, B, C, D, E). Pendente: lista final de números de enfermaria válidos por setor, a ser fornecida por Fred, para popular os dropdowns.

### 4.3 Acompanhamento Nefrológico
| Campo | Tipo | Observação |
|---|---|---|
| Data da interconsulta | data | |
| Motivo da interconsulta | texto/categórico | |
| Diagnóstico nefrológico principal | categórico estruturado | IRA / DRC-D / IRA sobre DRC |
| Etiologia | categórico estruturado | Sepse, Hipovolemia, NTA, Obstrução, Glomerulonefrite, Síndrome hepatorrenal, Cardiorrenal, Outras |
| Tags | multi-select livre | ex: HD, Sepse, NTA, GN, UTI, Cateter femoral, Transplante renal |
| Nível de prioridade | categórico, **definido manualmente pelo médico** | não calculado automaticamente |
| Situação dialítica | **campo estruturado** (toggle/select) | HD hoje / HD amanhã / Sem HD programada — alimenta filtro |
| Necessita discussão | booleano (Sim/Não) | sinaliza casos que precisam de reunião da equipe (ex: indicação de HD, biópsia renal, troca de modalidade, casos complexos); filtrável |
| Status de avaliação do dia | booleano, **marcação explícita** | médico precisa confirmar ativamente "avaliei e não há pendências" — não é inferido automaticamente por edição |
| Última atualização do registro | timestamp, automático | qualquer edição em qualquer campo atualiza este timestamp |
| Última avaliação médica | timestamp, atualizado **somente** ao marcar "avaliado hoje" | distinto do timestamp acima — uma edição de pendência às 18h não conta como nova avaliação clínica; permite auditoria fiel da atividade assistencial real |
| Pendências | lista de itens curtos | visíveis para quem assume o plantão; **somem ao serem resolvidas**; resolução é documentada na evolução (texto), não como campo de histórico separado |

### 4.4 Evolução (múltiplas por dia)
| Campo | Tipo | Observação |
|---|---|---|
| Data/hora | timestamp | |
| Autor | referência ao usuário | |
| Texto da evolução | texto livre | |
| Conduta | texto livre | |
| Opção "copiar evolução anterior" | ação de UI | reduz fricção de preenchimento |

> Permite múltiplas entradas no mesmo dia (intercorrências). Entrada anterior não é sobrescrita automaticamente — só se o próprio autor optar por editar/excluir a sua.

### 4.5 Exames (estruturados, com série temporal)

**Core com gráfico de evolução** (campos numéricos + data, plotáveis):
- Ureia, Creatinina, Na, K, pH/Bic, Hb, Plaquetas, Lactato

**Tabela editável sem gráfico** (estruturado, sem visualização temporal no MVP):
- Cl, Ca/Cai, P, Glicose, Albumina, TGO/TGP, BT/BD, Coagulograma (TTPA/REL, TAP/RNI), Urina (pH, densidade, leucócitos, eritrócitos, proteinúria, NaU, CrU, UrU)

**Sinais vitais/hemodinâmica:**
- Diurese, Balanço hídrico, PAS/PAD/PVC, T°C, Drogas vasoativas (dopa/dobuta/NOR com dose), Peso

> *Pendente: validar com a equipe se a divisão "core com gráfico vs. tabela simples" está correta, ou se algum campo do "sem gráfico" merece visualização temporal.*

### 4.6 Terapia Dialítica

**Hemodiálise:**
- Data, Indicação (Hipervolemia/Hipercalemia/Uremia/Dist. Hidroeletrolítico/Acidose/Outras)
- Tipo (HD clássica/Estendida/Hemolenta/UF/Hemofiltração/HDF)
- Cateter, Acesso (Jugular/Subclávia/Femoral/Fístula + lado D/E)
- Δt (duração), Capilar, Heparinização (Sistêmica/Regional/Sem), Dose
- Fluxo de sangue (QB), Fluxo de banho/dialisato (QD), Ultrafiltração (UF)
- Complicações (lista padronizada: sangramento, hematoma, infecção, arritmia, PCR, etc.)

**Diálise Peritoneal:**
- Tipo, Cateter, Volume infundido, Nº de banhos, Perdas

### 4.7 Escore Automático
- **CKD-EPI 2021** (sem fator raça) — calculado a partir de creatinina + idade + sexo
- **KDIGO de LRA** — estadiamento C1-C3 (creatinina) + U1-U3 (diurese), calculado a partir de creatinina basal, creatinina atual e diurese/peso
- Classificação do quadro: LRA isolada / LRA-D / DRC dialítica
- Transitória vs. persistente (calculado pela duração da alteração)

> Sem SOFA, sem AKIN, sem Charlson — escopo restrito a KDIGO por decisão da equipe.
> *Nota: validar com Chatiane o racional de ter sugerido AKIN/Charlson, caso quiseram cobrir algum cenário específico de pesquisa futura.*

### 4.8 Timeline (Aba 5)
Visão resumida e cronológica, **derivada automaticamente** dos eventos já registrados (não é entrada manual extra). Exemplo:

```
15/06 — Interconsulta solicitada
16/06 — IRA KDIGO 2
17/06 — IRA KDIGO 3
18/06 — Primeira HD
21/06 — Recuperação da diurese
24/06 — Alta da nefrologia
```

---

## 5. Telas / UX

### 5.0 Busca Global
Campo de busca acessível em qualquer tela do app (não só dentro do dashboard). Pesquisa por: nome, RG hospitalar, diagnóstico, etiologia, comorbidades, tags. Ganha importância conforme a base histórica de pacientes cresce (ver Seção 5.4).

### 5.1 Dashboard (tela principal)
- **Indicadores no topo** (visão operacional rápida da carga assistencial do dia): total de pacientes ativos, avaliados hoje, pendentes de avaliação, HD hoje, HD amanhã, necessitam discussão.
- **Alerta de pendentes de avaliação**: ao abrir o app (sem necessidade de notificação push), se houver pacientes sem "Status de avaliação do dia" marcado, exibir alerta visível (ex: "Existem N pacientes sem avaliação registrada hoje"), com clique levando à lista filtrada desses pacientes. Baseado exclusivamente no campo estruturado "Status de avaliação do dia" (Seção 4.3) — sem lógica adicional de horário/notificação no MVP.
- Cards organizados **por setor** (ver lista completa em 4.2.1: UTI Geral, UTI 2, UTI Coronariana, UTI Neo, PS, Enfermarias do PS, Clínica Médica, Cirurgia Geral, Ortopedia, GO, Pediatria, Onco-Hemato, Neurologia, UDIP, PS Pediátrico, UTR, RPA, Berçário)
- Cada card mostra: Nome, idade, leito, diagnóstico nefrológico principal, conduta atual resumida, situação dialítica (badge), status de avaliação do dia (indicador visual ✅/🔴), pendências (se houver), última atualização
- Identificação visual por setor (cor/ícone) para reconhecimento rápido

### 5.2 Filtros
- Diagnóstico: IRA / DRC-D / IRA sobre DRC
- Situação dialítica: HD hoje / HD amanhã / Sem HD programada
- Comorbidades: DM, HAS, IC, Cirrose, Neoplasia, Transplante
- Localização: Setor / Leito
- Demográficos: faixa etária, sexo
- Status de avaliação: avaliado hoje / pendente
- Necessita discussão: sim / não

### 5.3 Tela completa do paciente (ao abrir o card)
1. **Resumo** — dados demográficos, diagnósticos, comorbidades, setor/leito, status atual, conduta atual
2. **Evoluções** — histórico cronológico, múltiplas entradas por dia
3. **Exames** — tabela + gráficos de evolução dos parâmetros-core
4. **Terapia Dialítica** — prescrição atual + histórico de sessões. **Botão "Gerar prescrição em PDF"**: exporta os campos estruturados da prescrição vigente em documento formatado, pronto para impressão e entrega física à enfermagem (que não acessa o sistema diretamente)
5. **Timeline** — linha do tempo resumida de eventos-chave

### 5.4 Aba "Histórico de Pacientes" (arquivo completo)
Tela separada do dashboard de pacientes ativos, listando **todos os pacientes já acompanhados pela equipe em algum momento**, incluindo os que já tiveram alta/óbito/transferência. Objetivo: consulta para estudos e levantamentos epidemiológicos.
- Mesmos filtros do dashboard (diagnóstico, etiologia, comorbidades, faixa etária, sexo, período), porém sem o filtro implícito de "ativo"
- Pesquisável por nome/RG hospitalar
- Acesso aos dados históricos completos de cada paciente (evoluções, exames, prescrições de internações passadas), preservados conforme Seção 3.3
- Base para exportação CSV/Excel (Seção 7)

---

## 6. Concorrência e Versionamento

- **Last-write-wins** — concorrência simultânea é rara (equipe pequena), não há bloqueio de campo nem lock de edição.
- **Auditoria completa**: toda alteração relevante registra quem editou, o que mudou, e quando — requisito de rastreabilidade legal/clínica.

---

## 7. Banco de Dados para Pesquisa

- Toda a modelagem de dados estruturados é pensada desde o início para viabilizar análise científica futura: perfil epidemiológico de LRA, mortalidade, necessidade de TRS, recuperação renal, tempo de internação, fatores associados à diálise.
- **Exportação para CSV/Excel** de dados estruturados.

---

## 8. Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js (PWA) — alinhado ao stack já utilizado no NefroChart |
| UI | Tailwind CSS + shadcn/ui |
| Backend/Banco | Supabase (PostgreSQL), **região São Paulo (sa-east-1)** |
| Autenticação | Supabase Auth |
| Tempo real | Supabase Realtime (subscriptions) |
| Segurança de acesso | Row Level Security (RLS) restrito ao grupo de 7 nefrologistas |
| Deploy | Vercel ou Netlify |
| Instalação | PWA instalável em desktop, Android, iOS — sem necessidade de loja de aplicativos |

### 8.1 Considerações de conformidade (LGPD)
- Dado sensível (saúde) permanece em banco hospedado **fisicamente no Brasil** (Supabase região São Paulo) — mitiga a maior parte da preocupação de transferência internacional de dados.
- Front-end (Vercel/Netlify) funciona apenas como camada de interface; dados sensíveis não devem aparecer em URLs, logs ou analytics.
- **Sem CPF** coletado — reduz superfície de dado sensível.
- Recomendação: após protótipo funcional, apresentar à TI/compliance do HC-UFTM/EBSERH para formalização de uso institucional.

---

## 9. Visão de Futuro (fora do MVP)

- Interoperabilidade com **AGHU** e **Infolab** (via API ou extração de dados) — depende de autorização institucional de TI, não é requisito do MVP.
- Biomarcadores estruturais de LRA (NGAL, TIMP-2/IGFBP7) caso o serviço passe a dispor desses exames — ver nota sobre KDIGO 2026 (draft) na Seção 10.
- Avaliação de inclusão de estadiamento B0/B1 (biomarcador de lesão) conforme nova diretriz KDIGO, se aplicável.
- **Snapshot diário automático**: registro automático de um resumo estruturado do estado de cada paciente (data, diagnóstico principal, KDIGO, creatinina, diurese, situação dialítica, setor), construindo um banco epidemiológico longitudinal sem necessidade de revisão manual futura. Possibilita análises como tempo médio em KDIGO 3, tempo médio até início de HD, duração de terapia dialítica, evolução temporal da função renal. Não requer alteração da estrutura principal de dados — pode ser implementado depois como camada adicional. Base rica para mestrado, doutorado e publicações.
- **Relatórios automáticos mensais**: indicadores agregados do serviço (total de pacientes, IRA, DRC-D, IRA sobre DRC, HD realizada, óbitos, recuperação renal), com exportação para Excel/CSV. Consome os dados acumulados pelo snapshot diário.

---

## 10. Notas de Pesquisa Relevantes

- **KDIGO 2026 (draft, revisão pública em curso)**: primeira atualização desde 2012. Introduz conceito de **LRA-D (Acute Kidney Disease)** — disfunção renal com duração ≤3 meses, mapeando exatamente a categoria "IRA sobreposta à DRC" do serviço. Introduz também conceitos de LRA transitória (≤48h) vs. persistente (>48h–7 dias) e critérios de resolução completa/parcial — úteis para os campos de classificação e para critério de "dar baixa" do acompanhamento.

---

## 11. Pontos Abertos / Pendentes de Validação

1. Lista de números de enfermaria válidos por setor (a ser fornecida por Fred) — popula os dropdowns de setor/enfermaria.
2. Validar com Chatiane o racional de AKIN/Charlson (mantido fora do escopo por ora).
3. Confirmar divisão de exames "core com gráfico vs. tabela simples" (Seção 4.5) com a equipe após uso inicial.
4. Levar protótipo funcional para validação formal de compliance junto à TI/EBSERH antes de uso institucional pleno.
5. Definir template/layout da prescrição de diálise em PDF (Seção 5.3) — provavelmente espelhando o layout que a enfermagem já reconhece do folhão físico.

---

## 12. Decisões Já Fechadas (changelog de discussão)

- Card vivo, atualização contínua (não snapshot diário)
- Last-write-wins, sem bloqueio de edição
- Acesso restrito aos 7 nefrologistas, sem hierarquia, sem residente
- Sem suporte offline — internet sempre disponível
- Marcação de "avaliado hoje" é explícita, nunca inferida
- Pendências somem ao resolver; resolução documentada em texto na evolução
- Múltiplas evoluções por dia permitidas; edição/exclusão só pelo autor
- Escore: somente KDIGO (sem SOFA, AKIN, Charlson)
- RG hospitalar como identificador único; reinternação reativa ficha existente com histórico completo preservado
- Sem CPF
- Prioridade do paciente é decisão manual do médico
- Situação dialítica (HD hoje/amanhã/sem programação) é campo estruturado, não texto livre
- Stack: Next.js PWA (não Expo/React Native), sem gamificação, sem offline-first
- Supabase com região São Paulo (sa-east-1) para conformidade com LGPD
- Aba de histórico completo de pacientes (ativos + arquivados) para fins de estudo/pesquisa
- Exportação de prescrição de diálise em PDF para entrega física à enfermagem
- Leito/setor: granularidade de enfermaria (não sub-leito); mudança de setor/leito é campo sobrescrito, sem rastreamento de histórico de movimentação
- Verificação de duplicidade por RG hospitalar é obrigatória e automática no cadastro — não depende do médico lembrar que o paciente já foi visto antes
- Creatinina basal estruturada no Paciente (valor + data + fonte: Ambulatório/Internação anterior/Laboratório externo/Estimada)
- Motivo da Alta do Acompanhamento e Desfecho Renal são campos distintos (alta hospitalar ≠ resultado clínico renal)
- Busca global por nome/RG/diagnóstico/etiologia/comorbidades/tags, acessível em qualquer tela
- Alerta de pacientes pendentes de avaliação é visual, dentro do app ao abrir — sem notificação push no MVP
- Campo "Necessita discussão" (Sim/Não) no Acompanhamento Nefrológico, filtrável
- Indicadores agregados no topo do dashboard (ativos, avaliados hoje, pendentes, HD hoje, HD amanhã)
- "Última atualização do registro" e "Última avaliação médica" são timestamps distintos
- Snapshot diário automático fica como visão de futuro, não MVP
- Data provável de início da LRA (campo opcional) para cálculo de tempo até recuperação/HD e classificação transitória vs. persistente
- Etiologia da DRC estruturada com lista fechada de opções
- Comorbidades expandidas: DAC, Fibrilação atrial, Doença autoimune, Transplante separado em renal/hepático
- Relatórios automáticos mensais (futuro) com exportação Excel/CSV
- Roadmap fechado: exames/gráficos/KDIGO (Fase 2) antes de prescrição dialítica completa (Fase 3) — ordem definitiva

---

## 13. Roadmap de Implementação (fases sugeridas)

A especificação acima cobre o desenho funcional completo, mas a implementação será faseada:

- **Fase 1 (MVP 1)** — núcleo operacional: cadastro de paciente (com verificação de duplicidade), dashboard por setor, evoluções, status de avaliação do dia, pendências, busca global, indicadores agregados. Resolve a dor principal (substituir a folha física, visibilidade compartilhada da equipe).
- **Fase 2 (MVP 2)** — exames estruturados com gráfico de evolução, escore KDIGO e CKD-EPI 2021 automáticos.
- **Fase 3 (MVP 3)** — prescrição de diálise completa (HD + peritoneal) com exportação em PDF, aba de Histórico/Arquivo de pacientes.

> **Decisão fechada**: exames/gráficos/KDIGO antes da prescrição dialítica completa (ordem acima é definitiva, não sujeita a inversão).
