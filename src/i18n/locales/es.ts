import type en from "./en";

const es: typeof en = {
  // StepServiceType
  service_title: "¿Qué necesita?",
  service_subtitle: "Elija el servicio que se adapte a sus necesidades.",
  service_zip_label: "Código Postal",
  service_zip_placeholder: "90210",
  service_checking: "Verificando su área...",
  service_area_minimum: "Mínimo del área: {{sym}}{{min}}",
  service_unmapped: "¡Servimos su área! Contáctenos para un presupuesto personalizado",
  service_enter_zip: "Ingrese su código postal para verificar disponibilidad en su área.",

  // StepItemCatalog
  catalog_title: "Seleccione sus artículos",
  catalog_subtitle: "Agregue todo lo que necesita recoger.",
  catalog_search_placeholder: "Buscar artículos...",
  catalog_all_categories: "Todo",
  catalog_add_custom: "Agregar artículo personalizado",
  catalog_custom_placeholder: "Describa el artículo...",
  catalog_add_btn: "Agregar",
  catalog_photos_title: "Subir fotos",
  catalog_photos_subtitle: "Las fotos nos ayudan a prepararnos — obtenga {{pct}}% de descuento.",
  catalog_skip_photos: "Omitir — agregaré fotos después",

  // StepSchedule
  schedule_title: "Elija fecha y hora",
  schedule_subtitle: "Seleccione cuándo desea que vengamos.",
  schedule_no_times: "No hay ventanas de tiempo disponibles.",

  // StepCustomerDetails
  details_title: "Sus datos",
  details_subtitle: "Díganos dónde y cómo contactarle.",
  details_name: "Nombre completo",
  details_phone: "Teléfono",
  details_email: "Correo electrónico",
  details_address: "Dirección de recogida",
  details_address2: "Dirección línea 2",
  details_address2_placeholder: "Apto, Suite, Unidad, Piso (opcional)",
  details_property_type: "Tipo de propiedad",
  details_zip: "Código Postal",
  details_gate: "Código de acceso",
  details_notes: "Instrucciones especiales",
  details_notes_placeholder: "Los artículos están en el garaje. El perro es amigable.",
  details_promo_label: "Código promocional",
  details_promo_placeholder: "Ingrese código",
  details_promo_apply: "Aplicar",
  details_promo_applied: "Aplicado",
  details_promo_invalid: "Código promocional inválido o caducado.",
  details_promo_discount: "Descuento aplicado",
  property_house: "Casa",
  property_building: "Edificio",
  property_office: "Oficina",
  property_apartment: "Apartamento",

  // StepPayment
  payment_title: "Revisar y pagar",
  payment_subtitle_full: "Se requiere pago completo para confirmar su reserva.",
  payment_subtitle_deposit: "Se requiere un depósito del {{pct}}% para confirmar su reserva.",
  payment_terms_label: "Acepto los",
  payment_terms_link: "Términos de Servicio",
  payment_privacy_link: "Política de Cancelación",
  payment_terms_note: "Entiendo que los precios pueden ajustarse en el lugar según los artículos reales.",
  payment_total_due: "Total a pagar",
  payment_deposit_due: "Depósito a pagar",
  payment_pay_btn: "Pagar {{sym}}{{amount}}",
  payment_processing: "Procesando…",
  payment_secure: "Su pago está encriptado y seguro.",
  payment_powered_by: "Desarrollado por Stripe",
  payment_loading: "Cargando formulario de pago seguro…",
  payment_failed_title: "Pago fallido",
  payment_demo_note: "Modo demo — Stripe no conectado. Haga clic en pagar para simular la reserva.",

  // Success
  success_title: "¡Reserva Confirmada!",
  success_msg: "Gracias, {{name}}. Le veremos el {{date}} durante la ventana {{window}}.",
  success_email_sent: "Se ha enviado una confirmación a su correo electrónico.",
  success_service: "Servicio",
  success_items: "Artículos",
  success_total_paid: "Total Pagado",
  success_deposit_paid: "Depósito Pagado",
  success_ref: "Ref",

  // OrderSummary
  summary_title: "Resumen del pedido",
  summary_service: "Servicio",
  summary_date: "Fecha",
  summary_time: "Hora",
  summary_items: "Artículos",
  summary_subtotal: "Subtotal",
  summary_photo_discount: "Descuento por fotos",
  summary_total: "Total",
  summary_deposit: "Depósito ({pct}%)",
  summary_empty: "No hay artículos seleccionados aún.",

  // Navigation
  nav_back: "Atrás",
  nav_continue: "Continuar",
  nav_confirm: "Confirmar reserva",
} as const;

export default es;
