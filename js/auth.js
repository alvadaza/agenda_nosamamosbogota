import { supabase } from "./api.js";

const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const msg = document.getElementById("msg");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");

loginBtn.addEventListener("click", async () => {
  msg.textContent = "";
  const email = emailInput.value.trim();
  const password = passInput.value.trim();
  if (!email || !password) {
    msg.textContent = "Escribe correo y contraseña";
    return;
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      msg.textContent = "Error: " + error.message;
      console.error(error);
      return;
    }
    const user = data.user;
    const { data: profile, error: pe } = await supabase
      .from("profiles")
      .select("rol,is_admin")
      .eq("id", user.id)
      .single();
    if (pe) {
      msg.textContent = "Error leyendo perfil: " + pe.message;
      console.error(pe);
      return;
    }
    const isAdmin =
      profile && (profile.rol === "admin" || profile.is_admin === true);
    if (isAdmin) window.location.href = "admin.html";
    else window.location.href = "user.html";
  } catch (err) {
    console.error(err);
    msg.textContent = "Error inesperado";
  }
});

signupBtn.addEventListener("click", async () => {
  msg.textContent = "";
  const email = emailInput.value.trim();
  const password = passInput.value.trim();
  if (!email || !password) {
    msg.textContent = "Es necesario correo y contraseña";
    return;
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    msg.textContent = "Error: " + error.message;
    console.error(error);
    return;
  }
  msg.textContent = "Usuario creado. Revisa tu correo y luego inicia sesión.";
});
const togglePass = document.getElementById("togglePass");

togglePass.addEventListener("click", () => {
  if (passInput.type === "password") {
    passInput.type = "text";
    togglePass.textContent = "🙈";
  } else {
    passInput.type = "password";
    togglePass.textContent = "👁️";
  }
});
