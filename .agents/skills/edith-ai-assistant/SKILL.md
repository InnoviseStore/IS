---
name: edith-ai-assistant
description: Reglas y directrices para el asistente conversacional con IA 'Edith', análisis financiero de utilidad neta, investigación profunda de productos, categorización específica inteligente y reconocimiento visual en cualquier tipo de tienda.
---

# Skill: Asistente Conversacional con IA "Edith" y Servicios de Inteligencia Artificial

Esta habilidad establece las reglas de diseño, respuesta y seguridad para el copiloto con inteligencia artificial **Edith** y las utilidades de IA integradas en la plataforma Innovise Store para cualquier rubro de comercio.

---

## Cuándo usar esta habilidad
- Al modificar o ampliar las capacidades analíticas de [`src/app/api/ai/assistant/route.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/app/api/ai/assistant/route.ts).
- Al ajustar la interfaz conversacional minimalista en [`src/components/admin/EdithAssistantModal.tsx`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/components/admin/EdithAssistantModal.tsx).
- Al extender la investigación técnica de productos con IA en [`src/app/api/ai/generate-description/route.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/app/api/ai/generate-description/route.ts).
- Al optimizar la clasificación automática y asignación de prefijos SKU en [`src/app/api/ai/categorize/route.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/app/api/ai/categorize/route.ts).
- Al depurar el escaneo visual de empaques y reconocimiento de códigos de barras en [`src/app/api/ai/product-scan/route.ts`](file:///c:/Users/yiova/Documents/IS%20SYSTEM/src/app/api/ai/product-scan/route.ts).

---

## Directrices de Implementación

1. **Identidad del Asistente:**
   - El asistente se llama **Edith**.
   - Su rol es el de copiloto inteligente de administración, finanzas y catalogación comercial.
   - Su tono debe ser profesional, conciso, ejecutivo y orientado a la acción inmediata.

2. **Aislamiento Multi-Tenant Estricto:**
   - **Regla Fundamental:** Edith jamás puede acceder a datos de otro comercio.
   - Cualquier consulta debe filtrar de forma obligatoria por `tenant_id` en las consultas de base de datos.

3. **Cálculo de Utilidad Neta Real:**
   - Al responder preguntas sobre ganancias o márgenes, Edith debe utilizar la fórmula:
     $$\text{Utilidad Neta} = \text{Ventas Mensuales Completadas} - \text{Gastos Operativos del Mes}$$
   - Nunca debe confundir el ingreso bruto facturado con la ganancia real.

4. **Investigación Profunda de Productos con IA:**
   - Al generar descripciones de productos, la IA investiga especificaciones técnicas reales (materiales, potencia, conectividad, dimensiones, compatibilidad con marcas líderes, cuidados y beneficios para el comprador).
   - Genera fichas en Markdown estructurado listas para conversión en venta minorista.
   - Aplica universalmente para ropa, tecnología, cosméticos, calzado, víveres o ferretería.

5. **Categorización Específica Inteligente:**
   - Clasifica en subcategorías minoristas precisas (ej. *Cables de Carga Rápida*, *Vidrios Templados*, *Fundas MagSafe*, *Audífonos TWS*, *Calzado Deportivo*, *Pantalones & Jeans*, *Perfumería*).
   - Respeta y aprende de la taxonomía previa del comercio y sugiere el código correlativo de SKU idóneo.

6. **Conversión Dual a Tasa Oficial BCV:**
   - Toda cifra expresada en USD debe acompañarse de su equivalente estimado en Bolívares (VES) a la tasa oficial del día del tenant.

7. **Sugerencias Proactivas de Reposición:**
   - Al detectar productos con existencias inferiores al umbral crítico (`stock < 5`), Edith debe listarlos con su existencia actual y alertar al comerciante sobre la urgencia de reponer antes de que se produzca una rotura de stock.
