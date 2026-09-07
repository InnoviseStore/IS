# Módulo 9: Copiloto de Inteligencia Artificial "Edith"

## 1. Visión General
Edith es el asistente conversacional con inteligencia artificial nativa de **Innovise Store**, diseñado como alternativa superior al asistente Nina de FINA. Proporciona asesoría administrativa y financiera en tiempo real a los dueños y gerentes del negocio, consultando de manera segura la base de datos viva del comercio en Supabase.

---

## 2. Capacidades de Consulta en Lenguaje Natural

Edith atiende preguntas operativas y estratégicas directamente desde su widget flotante:

- **Reposición Inteligente de Inventario:**
  - *Pregunta:* "¿Qué productos debería reponer esta semana?"
  - *Acción:* Consulta artículos con `stock < 5` y sugiere emitir órdenes de compra.
- **Utilidad Neta Real y Rentabilidad:**
  - *Pregunta:* "¿Cuál fue mi ganancia neta este mes?"
  - *Acción:* Cruza ventas completadas del mes contra los gastos operativos asentados y calcula el margen neto en USD y Bolívares.
- **Facturación y Ventas:**
  - *Pregunta:* "¿Cuánto llevo vendido en el mes?"
  - *Acción:* Agrega el monto total facturado y lo expresa al tipo de cambio oficial del BCV.
- **Cuentas por Cobrar y Cobranzas:**
  - *Pregunta:* "¿Quiénes tienen deudas pendientes?"
  - *Acción:* Extrae los clientes con crédito a 7 días activo y sugiere disparar la cobranza por WhatsApp.

---

## 3. Arquitectura Técnica

- **Componente de Interfaz (`src/components/admin/EdithAssistantModal.tsx`):**
  - Botón flotante accesible en todas las vistas de administración.
  - Modal conversacional minimalista con estado de carga, indicador de IA activa y diseño de alto contraste.
- **Endpoint Seguro (`src/app/api/ai/assistant/route.ts`):**
  - Conexión con Supabase Service Role Key.
  - Aislamiento estricto por `tenant_id`: Edith únicamente analiza datos del comercio autenticado.
