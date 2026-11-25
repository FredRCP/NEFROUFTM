// Service worker do NEFRO-UFTM: recebe o aviso de fim do dia (16h30).

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(dados.title || "NEFRO-UFTM", {
      body: dados.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-48.png",
      tag: "aviso-fim-do-dia",
      renotify: true,
      data: { url: dados.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ("focus" in janela) {
          janela.navigate(url);
          return janela.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
