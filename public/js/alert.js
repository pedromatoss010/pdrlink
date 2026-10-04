(function () {
  const alertBox = document.getElementById("errAlert");
  const alertMsg = document.getElementById("errAlertMsg");
  const alertOk = document.getElementById("errAlertOk");
  
  if (!alertBox || !alertMsg || !alertOk) return;

  let hideTimer;
  let autoCloseTimer;

  function hideAlert() {
    alertBox.classList.add("is-hiding");
    hideTimer = setTimeout(function () {
      alertBox.hidden = true;
      alertBox.classList.remove("is-hiding");
    }, 250);
  }

  alertOk.addEventListener("click", function () {
    clearTimeout(hideTimer);
    clearTimeout(autoCloseTimer);
    hideAlert();
  });

  window.showError = function (msg, autoCloseMs = 0) {
    clearTimeout(hideTimer);
    clearTimeout(autoCloseTimer);
    
    alertMsg.textContent = msg || "Algo deu errado.";
    alertBox.hidden = false;
    alertBox.classList.remove("is-hiding"); 

    if (autoCloseMs > 0) {
      autoCloseTimer = setTimeout(hideAlert, autoCloseMs);
    }
  };
})();