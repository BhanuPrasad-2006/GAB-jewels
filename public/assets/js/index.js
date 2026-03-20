/* --- 1. INSTANT MEMORY CHECK --- */
if (localStorage.getItem("isLoggedIn") === "true") {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-site').style.display = 'block';
}

/* --- 2. LOGIN LOGIC --- */
function doLogin(){
  const e = document.getElementById('login-email').value;
  const p = document.getElementById('login-pass').value;

  if((e === 'demo@aurum.com' && p === '1234') || (e.includes('@') && p.length >= 4)){
    localStorage.setItem("isLoggedIn", "true"); 
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-site').style.display = 'block';
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

function guestLogin(){
  localStorage.setItem("isLoggedIn", "true"); 
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('main-site').style.display = 'block';
}

/* --- 3. PRODUCTS & CART --- */
const products = [
  {id:1, name:"Gold Ring", price:"₹18,000"},
  {id:2, name:"Necklace", price:"₹50,000"},
  {id:3, name:"Bracelet", price:"₹25,000"}
];

let cart = [];

function renderProducts(){
  let html = "";
  products.forEach(p=>{
    html += `
      <div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; display: inline-block; width: 200px; text-align: center;">
        <b>${p.name}</b><br>
        ${p.price}<br><br>
        <button onclick="addToCart(${p.id})">Add to Bag</button>
      </div>&nbsp;
    `;
  });
  const grid = document.getElementById("products-grid");
  if(grid) grid.innerHTML = html;
}

function addToCart(id){
  const p = products.find(x=>x.id===id);
  cart.push(p);
  document.getElementById("cart-count").innerText = cart.length;
  renderCart();
}

function renderCart(){
  let html="";
  cart.forEach(p=>{
    html += `${p.name} - ${p.price}<br>`;
  });
  document.getElementById("cart-body").innerHTML = html || "Your bag is empty";
}

/* --- 4. REAL-TIME GOLD API --- */
async function fetchLiveRates() {
  // GoldAPI requires the key to be passed in the Headers, not the URL
  const myHeaders = new Headers();
  myHeaders.append("x-access-token", "goldapi-agsbx8smmz307y8-io");
  myHeaders.append("Content-Type", "application/json");

  const requestOptions = {
    method: 'GET',
    headers: myHeaders,
    redirect: 'follow'
  };

  try {
    // 1. Fetch Gold Rates (XAU) in INR
    const goldRes = await fetch("https://www.goldapi.io/api/XAU/INR", requestOptions);
    const goldData = await goldRes.json();

    // 2. Fetch Silver Rates (XAG) in INR
    const silverRes = await fetch("https://www.goldapi.io/api/XAG/INR", requestOptions);
    const silverData = await silverRes.json();

    // GoldAPI provides price per gram. In India, rates are usually shown per 10 grams.
    const gold24k_10g = goldData.price_gram_24k * 10;
    const gold22k_10g = goldData.price_gram_22k * 10;
    
    // Silver is usually shown per 1 gram or 1 kg. We will do 1 gram.
    const silver_1g = silverData.price_gram_24k; 

    // Update HTML
    document.getElementById("p-24k").innerText = "₹" + Math.round(gold24k_10g).toLocaleString('en-IN');
    document.getElementById("p-22k").innerText = "₹" + Math.round(gold22k_10g).toLocaleString('en-IN');
    document.getElementById("p-silver").innerText = "₹" + silver_1g.toFixed(2);
    document.getElementById("last-updated").innerText = "Updated: " + new Date().toLocaleTimeString();

  } catch (error) {
    console.error("Error fetching live rates:", error);
    document.getElementById("last-updated").innerText = "API Limit Reached or Offline. Try again later.";
  }
}

/* --- INIT --- */
// Run functions when the file loads
renderProducts();
fetchLiveRates();

// Fetch new rates every 15 minutes (900,000 ms) to avoid burning through your 500 free daily requests
setInterval(fetchLiveRates, 900000);