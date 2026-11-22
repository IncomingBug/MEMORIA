// Storage Adapter Selector: dynamically binds AdapterLocal (Mode A) or AdapterFirebase (Mode B)
(function() {
  const config = window.MEMORIA_FIREBASE_CONFIG || {};
  const isFirebaseConfigured = Boolean(
    config.apiKey &&
    config.projectId &&
    typeof config.apiKey === "string" &&
    config.apiKey.trim().length > 0
  );
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const forceFirebase = window.MEMORIA_FORCE_FIREBASE === true;

  let adapter;
  if (isFirebaseConfigured && window.AdapterFirebase && (!isLocalHost || forceFirebase)) {
    console.log("MEMORIA v2: Initializing in MODE B (Firebase Spark Static)");
    adapter = new window.AdapterFirebase(config);
  } else {
    console.log("MEMORIA v2: Initializing in MODE A (Local Express + SQLite)");
    adapter = new window.AdapterLocal();
  }

  window.storageAdapter = adapter;
})();
