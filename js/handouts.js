/* =====================================================
   KidGrow Pro — Parent handouts EN / TA / HI (Round 4)
   Fever · diarrhoea · cold · post-vaccine · play Rx ·
   starting solids. Print & share.
   ===================================================== */
const HAND_LANGS = { en: "English", ta: "தமிழ்", hi: "हिंदी" };
const HANDOUTS = [
  { id: "fever", icon: "🌡️", title: { en: "Fever — home care", ta: "காய்ச்சல் — வீட்டில் பராமரிப்பு", hi: "बुखार — घर पर देखभाल" },
    bullets: {
      en: ["Fever is the body's way of fighting infection. Treat the child, not just the number.", "Give paracetamol (dose as prescribed) if the child is uncomfortable or fever is above 100.4°F (38°C).", "Offer plenty of fluids — water, breastmilk, soups, ORS.", "Dress lightly; do not over-wrap or give a cold-water bath.", "Check temperature every 4–6 hours and note it down.", "Antibiotics are not needed for most viral fevers."],
      ta: ["காய்ச்சல் நோயை எதிர்த்துப் போராடும் உடலின் வழி. எண்ணை மட்டும் பார்க்காமல் குழந்தையைக் கவனியுங்கள்.", "குழந்தை சிரமப்பட்டால் அல்லது காய்ச்சல் 100.4°F (38°C) க்கு மேல் இருந்தால் மருத்துவர் சொன்னபடி பாராசிட்டமால் கொடுங்கள்.", "நிறைய திரவம் கொடுங்கள் — தண்ணீர், தாய்ப்பால், சூப், ஓஆர்எஸ்.", "கனமான ஆடை வேண்டாம்; குளிர்ந்த நீரில் குளிப்பாட்ட வேண்டாம்.", "4–6 மணிக்கு ஒருமுறை வெப்பநிலை பார்த்து குறித்துக்கொள்ளுங்கள்.", "பெரும்பாலான வைரஸ் காய்ச்சலுக்கு ஆன்டிபயாடிக் தேவையில்லை."],
      hi: ["बुखार संक्रमण से लड़ने का शरीर का तरीका है। सिर्फ नंबर नहीं, बच्चे को देखें।", "बच्चा परेशान हो या बुखार 100.4°F (38°C) से ज़्यादा हो तो डॉक्टर की बताई खुराक में पैरासिटामॉल दें।", "खूब तरल पदार्थ दें — पानी, माँ का दूध, सूप, ओआरएस।", "भारी कपड़े न पहनाएँ; ठंडे पानी से न नहलाएँ।", "हर 4–6 घंटे में बुखार नापकर लिखें।", "ज़्यादातर वायरल बुखार में एंटीबायोटिक की ज़रूरत नहीं होती।"] },
    red: { en: "Return immediately: fits/seizure, unusually sleepy or limp, breathing difficulty, rash with fever, fever >3 days, baby <3 months with fever.",
      ta: "உடனே வாருங்கள்: வலிப்பு, அதிக மயக்கம்/தளர்ச்சி, மூச்சு சிரமம், காய்ச்சலுடன் தடிப்பு, 3 நாட்களுக்கு மேல் காய்ச்சல், 3 மாதத்திற்குட்பட்ட குழந்தைக்கு காய்ச்சல்.",
      hi: "तुरंत आएँ: दौरे/झटके, बहुत सुस्ती या ढीलापन, साँस लेने में तकलीफ, बुखार के साथ दाने, 3 दिन से ज़्यादा बुखार, 3 महीने से छोटे बच्चे को बुखार।" } },
  { id: "ors", icon: "💧", title: { en: "Diarrhoea + ORS", ta: "வயிற்றுப்போக்கு + ஓஆர்எஸ்", hi: "दस्त + ओआरएस" },
    bullets: {
      en: ["Start ORS from the first loose stool — small sips, often.", "Under 2 years: 50–100 mL after each stool. Above 2 years: 100–200 mL.", "Continue breastfeeding and normal feeds — do not starve the child.", "Give zinc (as prescribed) for 14 days.", "Wash hands with soap; give safe boiled/cooled water.", "No anti-diarrhoeal syrups or antibiotics without advice."],
      ta: ["முதல் மலம் முதலே ஓஆர்எஸ் கொடுங்கள் — கொஞ்சம் கொஞ்சமாக, அடிக்கடி.", "2 வயதிற்குட்பட்டவருக்கு: ஒவ்வொரு மலத்திற்கும் 50–100 மி.லி. 2 வயதிற்கு மேல்: 100–200 மி.லி.", "தாய்ப்பால், சாதாரண உணவைத் தொடருங்கள் — பட்டினி போட வேண்டாம்.", "மருத்துவர் சொன்னபடி 14 நாட்கள் துத்தநாகம் (ஜிங்க்) கொடுங்கள்.", "சோப்பால் கை கழுவுங்கள்; கொதித்து ஆறிய தண்ணீர் கொடுங்கள்.", "மருத்துவர் சொல்லாமல் வயிற்றுப்போக்கு மருந்து/ஆன்டிபயாடிக் வேண்டாம்."],
      hi: ["पहले ही पतले दस्त से ओआरएस शुरू करें — थोड़ा-थोड़ा, बार-बार।", "2 साल से छोटे: हर दस्त के बाद 50–100 मि.ली. 2 साल से बड़े: 100–200 मि.ली.", "माँ का दूध और सामान्य खाना जारी रखें — भूखा न रखें।", "डॉक्टर के बताए अनुसार 14 दिन तक ज़िंक दें।", "साबुन से हाथ धुलवाएँ; उबला-ठंडा पानी दें।", "बिना सलाह दस्त रोकने की दवा/एंटीबायोटिक न दें।"] },
    red: { en: "Return immediately: blood in stool, repeated vomiting, very thirsty / no urine, sunken eyes, unusually sleepy, high fever.",
      ta: "உடனே வாருங்கள்: மலத்தில் ரத்தம், தொடர் வாந்தி, அதிக தாகம் / சிறுநீர் இல்லை, கண் உள்ளே போதல், அதிக மயக்கம், அதிக காய்ச்சல்.",
      hi: "तुरंत आएँ: दस्त में खून, बार-बार उल्टी, बहुत प्यास / पेशाब बंद, धँसी आँखें, बहुत सुस्ती, तेज़ बुखार।" } },
  { id: "cold", icon: "🤧", title: { en: "Cold + cough", ta: "சளி + இருமல்", hi: "सर्दी + खाँसी" },
    bullets: {
      en: ["Most colds are viral and settle in 5–7 days.", "Saline nasal drops + steam ease a blocked nose.", "Continue breastfeeding/feeds; offer warm fluids.", "Honey (½ tsp) soothes cough above 1 year. No honey below 1 year.", "No cough syrups, antihistamines or antibiotics without advice.", "Keep the child away from smoke and dust."],
      ta: ["பெரும்பாலான சளி வைரஸால் வரும்; 5–7 நாட்களில் சரியாகும்.", "உப்பு நீர் மூக்கு சொட்டு + ஆவி பிடித்தல் அடைப்பைக் குறைக்கும்.", "தாய்ப்பால்/உணவைத் தொடருங்கள்; வெதுவெதுப்பான திரவம் கொடுங்கள்.", "1 வயதிற்கு மேல் ½ ஸ்பூன் தேன் இருமலைக் குறைக்கும். 1 வயதிற்குட்பட்ட குழந்தைக்கு தேன் வேண்டாம்.", "மருத்துவர் சொல்லாமல் இருமல் மருந்து/ஆன்டிபயாடிக் வேண்டாம்.", "புகை, தூசியிலிருந்து குழந்தையை விலக்கி வையுங்கள்."],
      hi: ["ज़्यादातर सर्दी वायरल होती है और 5–7 दिन में ठीक हो जाती है।", "नमकीन नाक की बूँदें + भाप बंद नाक खोलती हैं।", "माँ का दूध/खाना जारी रखें; गुनगुने तरल पदार्थ दें।", "1 साल के बाद ½ चम्मच शहद खाँसी में आराम देता है। 1 साल से छोटे को शहद न दें।", "बिना सलाह खाँसी की दवा/एंटीबायोटिक न दें।", "बच्चे को धुएँ और धूल से दूर रखें।"] },
    red: { en: "Return immediately: fast/noisy breathing, ribs pulling in, blue lips, poor feeding, ear pain with fever.",
      ta: "உடனே வாருங்கள்: வேகமான/சத்தமான மூச்சு, விலா எலும்பு உள்ளே இழுத்தல், உதடு நீலம், பால் குடிக்க மறுத்தல், காய்ச்சலுடன் காது வலி.",
      hi: "तुरंत आएँ: तेज़/आवाज़ वाली साँस, पसलियाँ धँसना, नीले होंठ, दूध न पीना, बुखार के साथ कान दर्द।" } },
  { id: "shots", icon: "💉", title: { en: "After vaccination", ta: "தடுப்பூசி போட்ட பின்", hi: "टीका लगने के बाद" },
    bullets: {
      en: ["Mild fever, pain or swelling for 1–2 days is common and harmless.", "Give paracetamol only if the child is uncomfortable (dose as prescribed).", "Apply a clean cool cloth on a sore injection site.", "Continue normal feeds; let the child play.", "Note the next due date on the vaccine card — do not miss it."],
      ta: ["1–2 நாட்கள் லேசான காய்ச்சல், வலி, வீக்கம் சாதாரணம்; கவலை வேண்டாம்.", "குழந்தை சிரமப்பட்டால் மட்டும் மருத்துவர் சொன்னபடி பாராசிட்டமால் கொடுங்கள்.", "வலிக்கும் இடத்தில் சுத்தமான குளிர் துணி வையுங்கள்.", "சாதாரண உணவைத் தொடருங்கள்; குழந்தை விளையாடட்டும்.", "அடுத்த தடுப்பூசி தேதியை அட்டையில் குறித்து தவறாமல் வாருங்கள்."],
      hi: ["1–2 दिन हल्का बुखार, दर्द या सूजन आम है; चिंता न करें।", "बच्चा परेशान हो तभी डॉक्टर की बताई खुराक में पैरासिटामॉल दें।", "दर्द वाली जगह साफ ठंडा कपड़ा रखें।", "सामान्य खाना जारी रखें; बच्चे को खेलने दें।", "अगले टीके की तारीख कार्ड पर लिखकर ज़रूर आएँ।"] },
    red: { en: "Return immediately: crying >3 hours inconsolably, seizure, floppy/unresponsive episode, breathing difficulty, fast-spreading swelling.",
      ta: "உடனே வாருங்கள்: 3 மணிக்கு மேல் தொடர் அழுகை, வலிப்பு, தளர்ந்து/மயங்கும் நிலை, மூச்சு சிரமம், வேகமாகப் பரவும் வீக்கம்.",
      hi: "तुरंत आएँ: 3 घंटे से ज़्यादा लगातार रोना, दौरे, ढीला/बेहोश होना, साँस की तकलीफ, तेज़ी से फैलती सूजन।" } },
  { id: "solids", icon: "🥣", title: { en: "Starting solids (~6 mo)", ta: "இணை உணவு (~6 மாதம்)", hi: "ऊपर का खाना (~6 माह)" },
    bullets: {
      en: ["Start around 6 months; breastmilk continues to 2 years.", "Begin with 2–3 spoonfuls once a day; increase slowly.", "First foods: rice porridge, ragi, mashed banana, dal → khichdi.", "Add a spoon of oil/ghee + mashed groundnut/egg (if taken) for energy.", "No honey, cow's milk as drink, tea, or junk food in year one.", "Try each new food for 3 days; watch for allergy."],
      ta: ["6 மாதத்தில் தொடங்குங்கள்; தாய்ப்பால் 2 வயது வரை தொடரும்.", "முதலில் 2–3 ஸ்பூன், ஒரு வேளை; மெதுவாக அதிகரியுங்கள்.", "முதல் உணவு: அரிசி கஞ்சி, ராகி, வாழைப்பழம், பருப்பு → கிச்சடி.", "சக்திக்கு ஒரு ஸ்பூன் எண்ணெய்/நெய், அரைத்த நிலக்கடலை/முட்டை (சாப்பிட்டால்).", "முதல் வருடம் தேன், பசும்பால் (குடிக்க), டீ, துரித உணவு வேண்டாம்.", "புது உணவை 3 நாள் கொடுத்து ஒவ்வாமை பாருங்கள்."],
      hi: ["6 माह के आसपास शुरू करें; माँ का दूध 2 साल तक जारी रखें।", "पहले 2–3 चम्मच, दिन में एक बार; धीरे-धीरे बढ़ाएँ।", "पहले खाद्य: चावल का दलिया, रागी, मसला केला, दाल → खिचड़ी।", "ताकत के लिए एक चम्मच तेल/घी, पिसी मूँगफली/अंडा (खाते हों तो)।", "पहले साल शहद, गाय का दूध (पीने को), चाय, जंक फूड नहीं।", "नया खाना 3 दिन देकर एलर्जी देखें।"] },
    red: { en: "Discuss with doctor: poor weight gain, frequent vomiting, blood in stool, food refusal >2 weeks.",
      ta: "மருத்துவரிடம் பேசுங்கள்: எடை கூடாமை, அடிக்கடி வாந்தி, மலத்தில் ரத்தம், 2 வாரத்திற்கு மேல் உணவு மறுப்பு.",
      hi: "डॉक्टर से बात करें: वज़न न बढ़ना, बार-बार उल्टी, दस्त में खून, 2 हफ़्ते से ज़्यादा खाना न खाना।" } },
  { id: "play", icon: "🧸", play: true, title: { en: "Play prescription", ta: "விளையாட்டு மருந்துச்சீட்டு", hi: "खेल परामर्श" },
    bands: [
      { maxM: 6, label: { en: "0–6 months", ta: "0–6 மாதம்", hi: "0–6 माह" }, bullets: {
        en: ["Talk, sing and smile back at every coo.", "Tummy time 2–3 times a day while awake.", "Show high-contrast pictures and rattles.", "No screen time — your face is the best toy."],
        ta: ["ஒவ்வொரு சத்தத்திற்கும் பேசி, பாடி, சிரித்து பதில் கொடுங்கள்.", "விழித்திருக்கும்போது தினம் 2–3 முறை குப்புறப்படுக்கை.", "தெளிவான படங்கள், கிலுகிலுப்பை காட்டுங்கள்.", "திரை வேண்டாம் — உங்கள் முகமே சிறந்த விளையாட்டு."],
        hi: ["हर आवाज़ पर बात करें, गाएँ, मुस्कुराकर जवाब दें।", "जागते समय दिन में 2–3 बार पेट के बल लिटाएँ।", "साफ चित्र और झुनझुने दिखाएँ।", "स्क्रीन बिल्कुल नहीं — आपका चेहरा सबसे अच्छा खिलौना है।"] } },
      { maxM: 12, label: { en: "6–12 months", ta: "6–12 மாதம்", hi: "6–12 माह" }, bullets: {
        en: ["Name objects during daily routines.", "Peek-a-boo, clapping and stacking cups.", "Let the baby bang, drop and explore safely.", "Read a picture book daily, even briefly."],
        ta: ["அன்றாட வேலையில் பொருட்களின் பெயர் சொல்லுங்கள்.", "கண்ணாமூச்சி, கைதட்டல், கப் அடுக்குதல்.", "தட்ட, போட, ஆராய பாதுகாப்பாக விடுங்கள்.", "தினம் சிறிது நேரம் படப்புத்தகம் படியுங்கள்."],
        hi: ["रोज़ के कामों में चीज़ों के नाम बताएँ।", "लुका-छिपी, ताली, कप जमाना।", "खटखटाने, गिराने, खोजने की सुरक्षित आज़ादी दें।", "रोज़ थोड़ी देर तस्वीरों वाली किताब पढ़ें।"] } },
      { maxM: 36, label: { en: "1–3 years", ta: "1–3 வயது", hi: "1–3 साल" }, bullets: {
        en: ["Pretend play: kitchen set, dolls, toy phone.", "Scribbling with crayons, sorting shapes.", "Simple instructions: 'bring the ball'.", "Outdoor play + sand/water play daily."],
        ta: ["நடிப்பு விளையாட்டு: சமையல் செட், பொம்மை.", "கிரேயானில் கிறுக்கல், வடிவம் பிரித்தல்.", "எளிய சொல்: 'பந்தைக் கொண்டு வா'.", "தினம் வெளி விளையாட்டு + மணல்/தண்ணீர் விளையாட்டு."],
        hi: ["नाटक-खेल: रसोई सेट, गुड़िया, खिलौना फ़ोन।", "क्रेयॉन से आड़ी-तिरछी लकीरें, आकार छाँटना।", "सरल निर्देश: 'गेंद लाओ'।", "रोज़ बाहर खेल + रेत/पानी का खेल।"] } },
      { maxM: 72, label: { en: "3–6 years", ta: "3–6 வயது", hi: "3–6 साल" }, bullets: {
        en: ["Stories and rhymes; ask 'what next?'.", "Drawing, puzzles, building blocks.", "Play with other children; take turns.", "Limit screens to 1 hour of quality content."],
        ta: ["கதை, பாடல்; 'அப்புறம் என்ன?' என்று கேளுங்கள்.", "ஓவியம், புதிர், கட்டிட பிளாக்.", "மற்ற குழந்தைகளுடன் விளையாடி முறை பழகுதல்.", "திரை நேரம் தரமான 1 மணி மட்டும்."],
        hi: ["कहानी-कविता; पूछें 'फिर क्या हुआ?'।", "चित्रकारी, पहेली, ब्लॉक जोड़ना।", "दूसरे बच्चों से खेलना; बारी लेना सीखना।", "स्क्रीन सिर्फ 1 घंटा अच्छा कंटेंट।"] } },
      { maxM: 9999, label: { en: "6 years+", ta: "6 வயது+", hi: "6 साल+" }, bullets: {
        en: ["Sports + 60 min active play daily.", "Reading habit: 15 min together.", "Chores build responsibility.", "Discuss online safety for any device use."],
        ta: ["விளையாட்டு + தினம் 60 நிமிட சுறுசுறுப்பு.", "வாசிப்பு பழக்கம்: சேர்ந்து 15 நிமிடம்.", "வீட்டு வேலை பொறுப்பை வளர்க்கும்.", "சாதன பயனுக்கு இணைய பாதுகாப்பு பேசுங்கள்."],
        hi: ["खेल + रोज़ 60 मिनट सक्रिय खेल।", "पढ़ने की आदत: साथ 15 मिनट।", "घर के काम ज़िम्मेदारी सिखाते हैं।", "डिवाइस पर ऑनलाइन सुरक्षा की बात करें।"] } },
    ] },
];
function playPick(ageM) {
  const play = HANDOUTS.find((h) => h.id === "play");
  return play.bands.find((b) => ageM <= b.maxM) || play.bands[play.bands.length - 1];
}
const HAND_SEL = { h: "fever", lang: "en" };
function renderHand() {
  if (!$("pg-hand")) return;
  const c = child();
  const h = HANDOUTS.find((x) => x.id === HAND_SEL.h) || HANDOUTS[0];
  const L = HAND_SEL.lang;
  let sub = "", bullets = h.bullets ? h.bullets[L] : [], red = h.red ? h.red[L] : "";
  if (h.play && c) {
    const ageM = ageBetween(c.dob).years * 12 + ageBetween(c.dob).months;
    const band = playPick(ageM);
    sub = ` · ${band.label[L]} (auto by age)`;
    bullets = band.bullets[L];
  }
  $("handBox").innerHTML = `
  <div class="toolbar no-print">
    <select onchange="HAND_SEL.h=this.value;renderHand()" style="max-width:220px">${HANDOUTS.map((x) => `<option value="${x.id}"${x.id === h.id ? " selected" : ""}>${x.icon} ${esc(x.title.en)}</option>`).join("")}</select>
    <select onchange="HAND_SEL.lang=this.value;renderHand()" style="max-width:140px">${Object.keys(HAND_LANGS).map((k) => `<option value="${k}"${k === L ? " selected" : ""}>${HAND_LANGS[k]}</option>`).join("")}</select>
    <span class="sp"></span><button class="btn btn-o btn-sm" onclick="printPage('pg-hand')">🖨️ Print handout</button>
  </div>
  <div class="vaxcard" style="max-width:640px;margin:0 auto">
    <div style="font-size:11px;letter-spacing:1px;color:var(--muted);font-weight:800">PARENT HANDOUT · ${esc(HAND_LANGS[L]).toUpperCase()}</div>
    <h2 style="margin:2px 0 4px">${h.icon} ${esc(h.title[L])}${esc(sub)}</h2>
    <div style="font-size:13px;color:var(--muted)">${esc(DB.settings.clinic || "")} · ${c ? esc(c.name) : ""} · ${fmtDate(todayISO())}</div>
    <ul style="font-size:14.5px;line-height:1.75;margin:12px 0;padding-left:22px">${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    ${red ? `<div class="alert a-red" style="margin:0">🚨 <div><b>${esc(red)}</b></div></div>` : ""}
  </div>`;
}
