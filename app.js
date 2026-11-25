// @author piercer
const STORAGE_KEY = "piercer_tebex_calc_v1";
const $ = (id) => document.getElementById(id);

const GATEWAYS = {
  paypal: { pct: 2.49, fixed: 0.40 },
  card: { pct: 3.50, fixed: 0.30 },
  pix: { pct: 1.50, fixed: 0.00 },
};

let mode = "sell";

function fmtUsd(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtBrl(n) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode,
      ecosystem: $("ecosystem").value,
      platformFeePct: $("platformFeePct").value,
      gatewayPreset: $("gatewayPreset").value,
      gwPct: $("gwPct").value,
      gwFixed: $("gwFixed").value,
      salePrice: $("salePrice").value,
      salesCount: $("salesCount").value,
      targetNet: $("targetNet").value,
      usdToBrl: $("usdToBrl").value,
      includePlus: $("includePlus").checked,
    }));
  } catch {}
}

try {
  const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (s) {
    if (s.mode === "reverse") mode = "reverse";
    ["ecosystem", "platformFeePct", "gatewayPreset", "gwPct", "gwFixed", "salePrice", "salesCount", "targetNet", "usdToBrl"].forEach((id) => {
      if (s[id] !== undefined) $(id).value = s[id];
    });
    if (typeof s.includePlus === "boolean") $("includePlus").checked = s.includePlus;
  }
} catch {}

function getRates() {
  const eco = $("ecosystem").value;
  $("customPlatformWrap").hidden = eco !== "custom";
  const platPct = eco === "custom" ? Math.max(0, Number($("platformFeePct").value) || 0) : Number(eco);
  const gwPct = Math.max(0, Number($("gwPct").value) || 0);
  const gwFixed = Math.max(0, Number($("gwFixed").value) || 0);
  const brlRate = Math.max(0.1, Number($("usdToBrl").value) || 5.75);
  return { platRate: platPct / 100, gwRate: gwPct / 100, gwFixed, brlRate };
}

function calcUnit(gross, platRate, gwRate, gwFixed) {
  const platFee = gross * platRate;
  const gwFee = gross * gwRate + gwFixed;
  const net = Math.max(0, gross - platFee - gwFee);
  return { gross, platFee, gwFee, totalFee: platFee + gwFee, net };
}

function calculate() {
  const { platRate, gwRate, gwFixed, brlRate } = getRates();
  const sales = Math.max(1, Math.floor(Number($("salesCount").value) || 1));
  const plusCost = $("includePlus").checked ? 15 : 0;

  let gross = 0;
  if (mode === "sell") {
    gross = Math.max(0.01, Number($("salePrice").value) || 0.01);
  } else {
    const desired = Math.max(0.01, Number($("targetNet").value) || 0.01);
    const denom = Math.max(0.05, 1 - platRate - gwRate);
    gross = (desired + gwFixed) / denom;
  }

  const unit = calcUnit(gross, platRate, gwRate, gwFixed);
  const monthlyNetUsd = Math.max(0, unit.net * sales - plusCost);
  const monthlyBrl = monthlyNetUsd * brlRate;

  $("outNetUnit").textContent = fmtUsd(unit.net);
  $("outNetBrlUnit").textContent = fmtBrl(unit.net * brlRate);
  $("outTotalFeeUnit").textContent = fmtUsd(unit.totalFee);
  $("outFeeBreakdown").textContent = `Plat: ${fmtUsd(unit.platFee)} • Gw: ${fmtUsd(unit.gwFee)}`;
  $("outMonthlyUsd").textContent = fmtUsd(monthlyNetUsd);
  $("outMonthlyMeta").textContent = mode === "sell"
    ? `${sales} vendas${plusCost ? " (-$15 Plus)" : ""}`
    : `Cobrar ${fmtUsd(gross)} por venda`;
  $("outMonthlyBrl").textContent = fmtBrl(monthlyBrl);
  $("outBrlRateSub").textContent = `1 USD = ${fmtBrl(brlRate)}`;

  $("grossBadge").textContent = `Bruto: ${fmtUsd(gross)}`;
  const pNet = Math.round((unit.net / gross) * 100);
  const pPlat = Math.round((unit.platFee / gross) * 100);
  const pGw = Math.max(0, 100 - pNet - pPlat);

  $("barNet").style.width = `${pNet}%`;
  $("barNet").textContent = pNet > 8 ? `${pNet}%` : "";
  $("barPlat").style.width = `${pPlat}%`;
  $("barPlat").textContent = pPlat > 6 ? `${pPlat}%` : "";
  $("barGw").style.width = `${pGw}%`;
  $("barGw").textContent = pGw > 6 ? `${pGw}%` : "";

  const r = 44, c = 2 * Math.PI * r;
  const netDash = (pNet / 100) * c;
  $("donutSvg").innerHTML = `
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--red)" stroke-width="14" />
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--green)" stroke-width="14"
      stroke-dasharray="${netDash} ${c}" transform="rotate(-90 60 60)" />
    <text x="60" y="64" text-anchor="middle" fill="var(--text)" font-size="16" font-weight="700" font-family="JetBrains Mono">${pNet}%</text>
  `;
  $("donutLegend").innerHTML = `● Você recebe: <strong style="color:var(--green)">${fmtUsd(unit.net)}</strong><br>● Taxas totais: <strong style="color:var(--red)">${fmtUsd(unit.totalFee)}</strong>`;

  const vols = [10, 25, 50, 100, 250];
  $("projBody").innerHTML = vols.map((v) => {
    const g = gross * v;
    const f = unit.totalFee * v;
    const n = Math.max(0, unit.net * v - plusCost);
    return `
      <tr>
        <td>${v}</td>
        <td>${fmtUsd(g)}</td>
        <td>${fmtUsd(f)}</td>
        <td>${fmtUsd(n)}</td>
        <td>${fmtBrl(n * brlRate)}</td>
      </tr>
    `;
  }).join("");

  saveState();
}

$("gatewayPreset").addEventListener("change", () => {
  const p = GATEWAYS[$("gatewayPreset").value];
  if (p) {
    $("gwPct").value = p.pct;
    $("gwFixed").value = p.fixed.toFixed(2);
  }
  $("printBtn").addEventListener("click", () => window.print());
$("resetBtn").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });

calculate();
});

["gwPct", "gwFixed"].forEach((id) => {
  $(id).addEventListener("input", () => {
    $("gatewayPreset").value = "custom";
    $("printBtn").addEventListener("click", () => window.print());
$("resetBtn").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });

calculate();
  });
});

document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    mode = t.dataset.mode;
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    $("sellFields").hidden = mode !== "sell";
    $("reverseFields").hidden = mode !== "reverse";
    $("printBtn").addEventListener("click", () => window.print());
$("resetBtn").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });

calculate();
  });
});

if (mode === "reverse") {
  document.querySelector('.tab[data-mode="reverse"]').click();
}

["ecosystem", "platformFeePct", "salePrice", "salesCount", "targetNet", "usdToBrl", "includePlus"].forEach((id) => {
  $(id).addEventListener("input", calculate);
  $(id).addEventListener("change", calculate);
});

$("fetchRateBtn").addEventListener("click", async () => {
  $("fetchRateBtn").disabled = true;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    if (data?.rates?.BRL) {
      $("usdToBrl").value = Number(data.rates.BRL).toFixed(2);
      $("rateNote").textContent = "Cotação atualizada!";
      $("printBtn").addEventListener("click", () => window.print());
$("resetBtn").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });

calculate();
    }
  } catch {
    $("rateNote").textContent = "Não foi possível atualizar agora.";
  } finally {
    $("fetchRateBtn").disabled = false;
  }
});

$("copyBtn").addEventListener("click", async () => {
  const txt = `Tebex (${$("grossBadge").textContent}) → Líquido: ${$("outNetUnit").textContent} (${$("outNetBrlUnit").textContent}) | Taxas: ${$("outTotalFeeUnit").textContent}`;
  try {
    await navigator.clipboard.writeText(txt);
    const toast = $("toast");
    toast.textContent = "Resumo copiado!";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  } catch {}
});

$("printBtn").addEventListener("click", () => window.print());
$("resetBtn").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });

calculate();

(() => {
  fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    .then((r) => r.json())
    .then((d) => {
      const bid = Number(d?.USDBRL?.bid);
      const el = document.getElementById('usdToBrl') || document.getElementById('usdBrl');
      if (bid > 0 && el) { el.value = bid.toFixed(2); el.dispatchEvent(new Event('input', { bubbles: true })); }
    }).catch(() => {});
})();
