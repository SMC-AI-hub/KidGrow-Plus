/* =====================================================
   KidGrow Pro — Parent handouts EN / TA / HI (Round 4)
   Rich format (v10.12.0): what's happening · golden rule ·
   numbered do-steps · don't-myths · what to expect ·
   red flags · weight-based strips · breath guide ·
   meal/storage charts · clinic letterhead.
   Feeding guidance aligned with WHO (2023), IAP and
   standard IYCF references (incl. Elizabeth, Nutrition
   & Child Development, latest ed.).
   ===================================================== */
const HAND_LANGS = { en: "English", ta: "தமிழ்", hi: "हिंदी" };
const HAND_SECLBL = {
  about: { en: "ℹ️ What's happening", ta: "ℹ️ என்ன நடக்கிறது", hi: "ℹ️ क्या हो रहा है" },
  do: { en: "✅ Do at home", ta: "✅ வீட்டில் செய்யுங்கள்", hi: "✅ घर पर करें" },
  dont: { en: "🚫 Avoid these mistakes", ta: "🚫 இந்தத் தவறுகளைத் தவிருங்கள்", hi: "🚫 इन गलतियों से बचें" },
  expect: { en: "🕐 What to expect", ta: "🕐 என்ன எதிர்பார்க்கலாம்", hi: "🕐 क्या उम्मीद करें" },
  foot: { en: "This handout supports — not replaces — your doctor's advice.", ta: "இந்தக் குறிப்பு மருத்துவர் ஆலோசனைக்குத் துணை — மாற்று அல்ல.", hi: "यह पर्ची डॉक्टर की सलाह का साथ है — विकल्प नहीं।" },
};
const HAND_DOSE_TXT = {
  en: (nm, wt, mg, sy, dr) => `⚖️ For <b>${esc(nm)} (${wt} kg)</b>: paracetamol 15 mg/kg = <b>${mg} mg</b> ≈ <b>${sy} mL</b> of 120 mg/5 mL syrup <i>or</i> <b>${dr} mL</b> of 100 mg/mL drops, every 4–6 hrs if needed (max 4/day). Confirm with your doctor.`,
  ta: (nm, wt, mg, sy, dr) => `⚖️ <b>${esc(nm)} (${wt} கிலோ)</b>: பாராசிட்டமால் 15 மி.கி/கிலோ = <b>${mg} மி.கி</b> ≈ 120 மி.கி/5 மி.லி மருந்தில் <b>${sy} மி.லி</b> <i>அல்லது</i> 100 மி.கி/மி.லி சொட்டில் <b>${dr} மி.லி</b>; தேவைப்பட்டால் 4–6 மணிக்கு ஒருமுறை (அதிகம் 4/நாள்). மருத்துவரிடம் உறுதி செய்யுங்கள்.`,
  hi: (nm, wt, mg, sy, dr) => `⚖️ <b>${esc(nm)} (${wt} किलो)</b>: पैरासिटामॉल 15 मि.ग्रा/किलो = <b>${mg} मि.ग्रा</b> ≈ 120 मि.ग्रा/5 मि.ली सिरप के <b>${sy} मि.ली</b> <i>या</i> 100 मि.ग्रा/मि.ली ड्रॉप्स के <b>${dr} मि.ली</b>; ज़रूरत पर हर 4–6 घंटे (ज़्यादा से ज़्यादा 4/दिन)। डॉक्टर से पुष्टि करें।`,
};
const HAND_ORS_TXT = {
  en: (nm, wt, vol) => `💧 For <b>${esc(nm)} (${wt} kg)</b>: about <b>${vol} mL ORS over the next 4 hours</b> by spoon/small sips (roughly a glass an hour for small children), plus breastfeeding and normal feeds. If vomiting, pause 10 min then restart slower.`,
  ta: (nm, wt, vol) => `💧 <b>${esc(nm)} (${wt} கிலோ)</b>: அடுத்த 4 மணியில் சுமார் <b>${vol} மி.லி ஓஆர்எஸ்</b> ஸ்பூனால்/சிறிதாக (சிறு குழந்தைக்கு மணிக்கு சுமார் ஒரு டம்ளர்), தாய்ப்பால் + சாதாரண உணவுடன். வாந்தி வந்தால் 10 நிமிடம் நிறுத்தி மெதுவாக மீண்டும் தொடங்குங்கள்.`,
  hi: (nm, wt, vol) => `💧 <b>${esc(nm)} (${wt} किलो)</b>: अगले 4 घंटों में लगभग <b>${vol} मि.ली ओआरएस</b> चम्मच/छोटे घूँटों से (छोटे बच्चों को घंटे में लगभग एक गिलास), माँ के दूध + सामान्य खाने के साथ। उल्टी हो तो 10 मिनट रुककर धीरे फिर शुरू करें।`,
};
const HAND_BREATH = {
  en: "🫁 <b>Breath check (1 min, while calm — not crying/feeding):</b> under 2 months — <b>60+</b> breaths/min · 2–12 months — <b>50+</b> · 1–5 years — <b>40+</b> → return the SAME DAY. Also return if ribs pull in with each breath or in-breathing is noisy.",
  ta: "🫁 <b>மூச்சு பரிசோதனை (அமைதியாக இருக்கும்போது 1 நிமிடம் — அழாமல்/பால் குடிக்காமல்):</b> 2 மாதத்திற்குட்பட்ட — <b>60+</b> மூச்சு/நிமிடம் · 2–12 மாதம் — <b>50+</b> · 1–5 வயது — <b>40+</b> → அதே நாளில் வாருங்கள். ஒவ்வொரு மூச்சிலும் விலா உள்ளே இழுத்தாலோ, மூச்சிழுக்கும்போது சத்தம் வந்தாலோ உடனே வாருங்கள்.",
  hi: "🫁 <b>साँस-जाँच (शांत होने पर पूरा 1 मिनट — रोता/दूध पीता न हो):</b> 2 माह से छोटा — <b>60+</b> साँस/मिनट · 2–12 माह — <b>50+</b> · 1–5 साल — <b>40+</b> → उसी दिन आएँ। हर साँस में पसली धँसे या साँस लेते समय आवाज़ आए तो तुरंत आएँ।",
};
function handDose(wt) {
  const mg = Math.round(wt * 15), r1 = (x) => Math.round(x * 10) / 10;
  return { mg, syrup: r1(mg / 24), drops: r1(mg / 100) };
}
function handOrs(wt) { return Math.round((wt * 75) / 50) * 50; }
const HANDOUTS = [
  { id: "nbwarn", icon: "🍼", title: { en: "Newborn warning signs (0–28 days)", ta: "பிறந்த குழந்தை எச்சரிக்கை (0–28 நாள்)", hi: "नवजात चेतावनी-लक्षण (0–28 दिन)" },
    about: { en: "The first 28 days are the most delicate — newborns can turn serious quickly while showing only small signs. When in doubt, bring the baby the same day; do not wait and watch at home.",
      ta: "முதல் 28 நாட்கள் மிக மென்மையானவை — பிறந்த குழந்தை சிறு அறிகுறியுடன் வேகமாக மோசமாகலாம். சந்தேகம் என்றால் அதே நாளில் கொண்டு வாருங்கள்; வீட்டில் காத்திருக்க வேண்டாம்.",
      hi: "पहले 28 दिन सबसे नाज़ुक होते हैं — नवजात छोटे लक्षणों से जल्दी गंभीर हो सकता है। शक हो तो उसी दिन लाएँ; घर पर इंतज़ार न करें।" },
    bullets: {
      en: ["Feed every 2–3 hours (8–12 feeds/day); wake and feed if sleeping too long.", "Keep baby comfortably warm: cap, socks, skin-to-skin; neither too hot nor cold.", "Count breathing when calm: 60+ breaths/min in a newborn needs same-day review.", "Keep the cord stump clean and dry; fold the nappy below it.", "Wash hands before touching the baby; keep sick visitors away."],
      ta: ["2–3 மணிக்கு ஒருமுறை (நாளில் 8–12 வேளை) பால் கொடுங்கள்; அதிகம் தூங்கினால் எழுப்பி ஊட்டுங்கள்.", "குழந்தையை இதமான சூட்டில் வையுங்கள்: தொப்பி, சாக்ஸ், தோலோடு தோல்; அதிக சூடு/குளிர் வேண்டாம்.", "அமைதியாக இருக்கும்போது மூச்சு எண்ணுங்கள்: நிமிடத்திற்கு 60+ என்றால் அதே நாள் பரிசோதனை.", "தொப்புள் கொடித் துண்டை சுத்தமாக உலர வையுங்கள்; டயாபரை அதற்குக் கீழே மடியுங்கள்.", "குழந்தையைத் தொடுமுன் கை கழுவுங்கள்; நோயுற்ற விருந்தினரை விலக்குங்கள்."],
      hi: ["हर 2–3 घंटे (दिन में 8–12 बार) दूध पिलाएँ; ज़्यादा सोए तो जगाकर पिलाएँ।", "बच्चे को आरामदायक गरमाहट में रखें: टोपी, मोज़े, त्वचा-से-त्वचा; न ज़्यादा गर्म, न ठंडा।", "शांत होने पर साँस गिनें: नवजात में 60+/मिनट हो तो उसी दिन दिखाएँ।", "नाल-ठूँठ साफ-सूखा रखें; डायपर उसके नीचे मोड़ें।", "बच्चे को छूने से पहले हाथ धोएँ; बीमार मिलने वालों से दूर रखें।"] },
    dont: { en: ["Don't bathe in cold water or leave the baby in direct AC draught.", "Don't apply anything (oil, ash, powder) on the cord stump.", "Don't give water, honey, or gripe water — only breastmilk unless advised."],
      ta: ["குளிர் நீரில் குளிப்பாட்டவோ, ஏசி நேர் காற்றில் விடவோ வேண்டாம்.", "தொப்புள் துண்டில் எண்ணெய், சாம்பல், பவுடர் எதுவும் போட வேண்டாம்.", "தண்ணீர், தேன், கிரைப் வாட்டர் வேண்டாம் — மருத்துவர் சொல்லும் வரை தாய்ப்பால் மட்டும்."],
      hi: ["ठंडे पानी से न नहलाएँ, एसी की सीधी हवा में न रखें।", "नाल-ठूँठ पर तेल, राख, पाउडर कुछ न लगाएँ।", "पानी, शहद, ग्राइप वॉटर न दें — सलाह तक सिर्फ माँ का दूध।"] },
    expect: { en: "Weight dips slightly in week 1, then climbs. Sneezing, hiccups, and noisy breathing while feeding are usually normal in the first weeks.",
      ta: "முதல் வாரம் எடை சிறிது குறைந்து பின் ஏறும். தும்மல், விக்கல், பால் குடிக்கும்போது மூச்சு சத்தம் — முதல் வாரங்களில் பெரும்பாலும் சாதாரணம்.",
      hi: "पहले हफ़्ते वज़न थोड़ा घटकर फिर बढ़ता है। छींक, हिचकी, दूध पीते समय साँस की आवाज़ — पहले हफ़्तों में अक्सर सामान्य है।" },
    red: { en: "Bring the SAME DAY: not feeding well, unusual sleepiness/floppiness, fast breathing (60+/min), ribs pulling in, fever or cold to touch, fits, yellow palms/soles, red cord with pus, vomiting everything.",
      ta: "அதே நாளில் கொண்டு வாருங்கள்: சரியாகப் பால் குடிக்காமை, அதிக மயக்கம்/தளர்ச்சி, வேக மூச்சு (60+/நிமிடம்), விலா உள்ளே இழுத்தல், காய்ச்சல்/தொட்டால் குளிர், வலிப்பு, உள்ளங்கை/பாதம் மஞ்சள், சீழுடன் சிவந்த தொப்புள், எல்லாம் வாந்தி.",
      hi: "उसी दिन लाएँ: ठीक से दूध न पीना, बहुत सुस्ती/ढीलापन, तेज़ साँस (60+/मिनट), पसलियाँ धँसना, बुखार या छूने पर ठंडा, दौरे, हथेली/तलवे पीले, मवाद वाली लाल नाल, सब कुछ उल्टी करना।" } },
  { id: "breastfeed", icon: "🤱", title: { en: "Breastfeeding — complete guide", ta: "தாய்ப்பால் — முழு வழிகாட்டி", hi: "स्तनपान — पूरी मार्गदर्शिका" },
    about: { en: "Breastmilk is complete food + drink + medicine for the first 6 months — nothing else needed, not even water. It protects against infections, builds brains, and every feed makes more milk.",
      ta: "முதல் 6 மாதம் தாய்ப்பாலே முழு உணவு + தண்ணீர் + மருந்து — தண்ணீர் கூடத் தேவையில்லை. நோயிலிருந்து காக்கும், மூளை வளர்க்கும்; ஒவ்வொரு ஊட்டும் பாலை அதிகரிக்கும்.",
      hi: "पहले 6 माह माँ का दूध ही पूरा खाना + पानी + दवा है — पानी तक की ज़रूरत नहीं। संक्रमण से बचाता है, दिमाग़ बढ़ाता है; हर बार पिलाने से दूध बढ़ता है।" },
    pearl: { en: "💛 Golden rule: more suckling → more milk. Every extra feed today builds tomorrow's supply.",
      ta: "💛 பொன் விதி: அதிக சப்புதல் → அதிக பால். இன்றைய கூடுதல் ஊட்டு நாளைய சுரப்பைக் கூட்டும்.",
      hi: "💛 सुनहरा नियम: ज़्यादा चूसना → ज़्यादा दूध। आज का हर अतिरिक्त बार कल की आपूर्ति बढ़ाता है।" },
    chartTitle: { en: "🍼 Expressed-milk storage", ta: "🍼 பிழிந்த பால் சேமிப்பு", hi: "🍼 निकाले दूध का भंडारण" },
    chart: { head: { en: ["Where", "How long", "Tip"], ta: ["எங்கே", "எவ்வளவு நேரம்", "குறிப்பு"], hi: ["कहाँ", "कितनी देर", "सलाह"] },
      rows: {
        en: [["Room (≤25°C)", "Up to 4 hours", "Use first"], ["Fridge (4°C, back shelf)", "Up to 4 days", "Not in the door"], ["Freezer (−18°C)", "6 months best, 12 max", "Small portions"], ["Thawed milk", "24 hours in fridge", "Never refreeze"]],
        ta: [["அறை வெப்பம் (≤25°C)", "4 மணி வரை", "முதலில் இதைப் பயன்படுத்துங்கள்"], ["ஃபிரிட்ஜ் (4°C, உள் அலமாரி)", "4 நாள் வரை", "கதவில் வேண்டாம்"], ["ஃபிரீசர் (−18°C)", "6 மாதம் நல்லது, அதிகம் 12", "சிறு பங்குகளாக"], ["உருகிய பால்", "ஃபிரிட்ஜில் 24 மணி", "மீண்டும் உறைய வேண்டாம்"]],
        hi: [["कमरा (≤25°C)", "4 घंटे तक", "पहले इसे इस्तेमाल करें"], ["फ्रिज (4°C, अंदर की शेल्फ़)", "4 दिन तक", "दरवाज़े में नहीं"], ["फ़्रीज़र (−18°C)", "6 माह अच्छा, ज़्यादा 12", "छोटे हिस्सों में"], ["पिघला दूध", "फ्रिज में 24 घंटे", "दोबारा जमाएँ नहीं"]] } },
    bullets: {
      en: ["Start within 1 hour of birth — skin-to-skin; the first yellow milk (colostrum) is the baby's first vaccine.", "Feed on demand, 8–12 times a day, including night — crying is a LATE hunger sign; watch for lip-smacking, rooting, fist-sucking.", "Good attachment: mouth wide open, lower lip turned out, chin touching breast, cheeks full (not dimpled).", "Let the baby finish one breast before switching — the later hindmilk is richer in fat.", "Burp after every feed (shoulder hold, 5–10 min); 6+ wet nappies a day means enough milk.", "Mother eats + drinks normally — one extra roti/dal serving, plenty of water; no food needs banning while nursing.", "Continue breastfeeding to 2 years and beyond, alongside family foods after 6 months."],
      ta: ["பிறந்த 1 மணிக்குள் தொடங்குங்கள் — தோலோடு தோல்; முதல் மஞ்சள் பால் (சீம்பால்) குழந்தையின் முதல் தடுப்பூசி.", "கேட்கும்போதெல்லாம் ஊட்டுங்கள் — நாளில் 8–12 முறை, இரவும் சேர்த்து; அழுகை தாமத அறிகுறி — உதடு சப்புதல், திரும்புதல், கை சப்புதலைப் பாருங்கள்.", "நல்ல பிடிப்பு: வாய் அகலத் திறந்து, கீழுதடு வெளியே மடிந்து, மோவாய் மார்பில் ஒட்டி, கன்னம் நிறைந்திருக்கும்.", "ஒரு மார்பை முடிக்க விட்டுப் பின் மாறுங்கள் — பின் வரும் பாலில் கொழுப்பு அதிகம்.", "ஒவ்வொரு ஊட்டுக்கும் பின் ஏப்பம் (தோளில் 5–10 நிமிடம்); நாளில் 6+ ஈர டயாபர் = பால் போதும்.", "தாய் சாதாரணமாகச் சாப்பிடுங்கள் — ஒரு கூடுதல் சாதம்/பருப்பு, நிறைய தண்ணீர்; பாலூட்டும்போது எந்த உணவும் தடை இல்லை.", "6 மாதத்திற்குப் பின் குடும்ப உணவுடன் 2 வயது வரை தாய்ப்பால் தொடருங்கள்."],
      hi: ["जन्म के 1 घंटे के भीतर शुरू करें — त्वचा-से-त्वचा; पहला पीला दूध (खीस) बच्चे का पहला टीका है।", "माँग पर पिलाएँ — दिन में 8–12 बार, रात समेत; रोना देर का संकेत है — होंठ चाटना, मुँह घुमाना, मुट्ठी चूसना देखें।", "अच्छी पकड़: मुँह पूरा खुला, नीचे का होंठ बाहर मुड़ा, ठुड्डी छाती से सटी, गाल भरे (धँसे नहीं)।", "दूसरी तरफ़ जाने से पहले एक स्तन पूरा पिलाएँ — बाद वाले दूध में वसा ज़्यादा होती है।", "हर बार डकार दिलाएँ (कंधे पर 5–10 मिनट); दिन में 6+ गीले डायपर = दूध पर्याप्त।", "माँ सामान्य खाना खाएँ — एक रोटी/दाल ज़्यादा, खूब पानी; दूध पिलाते समय कोई खाना बंद नहीं।", "6 माह के बाद घर के खाने के साथ 2 साल तक माँ का दूध जारी रखें।"] },
    dont: { en: ["Don't give water, honey, gripe water, or formula in the first 6 months — breastmilk covers all needs.", "Don't use feeding bottles — they cause nipple confusion + infections; use spoon/paladai for expressed milk.", "Don't time feeds by the clock or skip night feeds — night suckling builds supply."],
      ta: ["முதல் 6 மாதம் தண்ணீர், தேன், கிரைப் வாட்டர், ஃபார்முலா வேண்டாம் — தாய்ப்பாலே அனைத்தும்.", "பால் பாட்டில் வேண்டாம் — குழப்பம் + தொற்று; பிழிந்த பாலை ஸ்பூன்/பாலாடையில் கொடுங்கள்.", "கடிகாரம் பார்த்து ஊட்டவோ, இரவு ஊட்டைத் தவிர்க்கவோ வேண்டாம் — இரவுப் பால் சுரப்பைக் கூட்டும்."],
      hi: ["पहले 6 माह पानी, शहद, ग्राइप वॉटर, फ़ॉर्मूला न दें — माँ का दूध ही सब कुछ है।", "दूध की बोतल न दें — भ्रम + संक्रमण; निकाला दूध चम्मच/पलाडाई से पिलाएँ।", "घड़ी देखकर न पिलाएँ, रात का दूध न छोड़ें — रात को चूसने से आपूर्ति बढ़ती है।"] },
    expect: { en: "Feeding feels frequent in weeks 1–2 (colostrum is small but mighty). By weeks 3–4 a rhythm sets in; breasts feel softer after feeds — softness means flow, not low supply.",
      ta: "1–2வது வாரம் அடிக்கடி ஊட்ட வேண்டும் (சீம்பால் குறைவு, சக்தி அதிகம்). 3–4வது வாரத்தில் ஒழுங்கு வரும்; ஊட்டுக்குப் பின் மார்பு மென்மை = நல்ல ஓட்டம், குறைவு அல்ல.",
      hi: "पहले 1–2 हफ़्ते बार-बार पिलाना पड़ता है (खीस थोड़ा पर ताकतवर)। 3–4 हफ़्तों में लय बनती है; पिलाने के बाद नरमी = अच्छा बहाव, कमी नहीं।" },
    red: { en: "See the doctor promptly: baby not latching after 24 hrs, fewer than 6 wet nappies after day 4, weight loss >10%, fever in baby — or mother has breast redness + fever + pain (possible infection).",
      ta: "உடனே மருத்துவரிடம்: 24 மணிக்குப் பின்னும் பிடிக்காமை, 4ம் நாளுக்குப் பின் 6க்குக் குறைவான ஈர டயாபர், 10%க்கு மேல் எடை குறைவு, குழந்தைக்குக் காய்ச்சல் — அல்லது தாய்க்கு மார்பு சிவப்பு + காய்ச்சல் + வலி.",
      hi: "तुरंत डॉक्टर को दिखाएँ: 24 घंटे बाद भी पकड़ न बनना, चौथे दिन के बाद 6 से कम गीले डायपर, 10% से ज़्यादा वज़न घटना, बच्चे को बुखार — या माँ को स्तन में लाली + बुखार + दर्द।" } },
  { id: "fever", icon: "🌡️", dose: true, title: { en: "Fever — home care", ta: "காய்ச்சல் — வீட்டில் பராமரிப்பு", hi: "बुखार — घर पर देखभाल" },
    about: { en: "Fever (100.4°F / 38°C or more) is the body's defence against infection. Most childhood fevers are viral and settle in 2–3 days. How the child behaves matters more than the thermometer number.",
      ta: "காய்ச்சல் (100.4°F / 38°C அல்லது அதற்கு மேல்) நோயை எதிர்க்கும் உடலின் பாதுகாப்பு. பெரும்பாலான காய்ச்சல் வைரஸால் வந்து 2–3 நாட்களில் சரியாகும். தெர்மாமீட்டர் எண்ணை விட குழந்தையின் செயலே முக்கியம்.",
      hi: "बुखार (100.4°F / 38°C या ज़्यादा) संक्रमण से लड़ने की शरीर की रक्षा है। बच्चों के ज़्यादातर बुखार वायरल होते हैं और 2–3 दिन में ठीक हो जाते हैं। थर्मामीटर के नंबर से ज़्यादा बच्चे का बर्ताव मायने रखता है।" },
    bullets: {
      en: ["Fever is the body's way of fighting infection. Treat the child, not just the number.", "Give paracetamol (dose as prescribed) if the child is uncomfortable or fever is above 100.4°F (38°C).", "Paracetamol 10–15 mg/kg every 4–6 hours; maximum 4 doses in 24 hours.", "Offer plenty of fluids — water, breastmilk, soups, ORS.", "Dress lightly; do not over-wrap or give a cold-water bath.", "Check temperature every 4–6 hours and note it down.", "Antibiotics are not needed for most viral fevers."],
      ta: ["காய்ச்சல் நோயை எதிர்த்துப் போராடும் உடலின் வழி. எண்ணை மட்டும் பார்க்காமல் குழந்தையைக் கவனியுங்கள்.", "குழந்தை சிரமப்பட்டால் அல்லது காய்ச்சல் 100.4°F (38°C) க்கு மேல் இருந்தால் மருத்துவர் சொன்னபடி பாராசிட்டமால் கொடுங்கள்.", "4–6 மணிக்கு ஒருமுறை 10–15 மி.கி/கிலோ பாராசிட்டமால்; 24 மணியில் அதிகம் 4 வேளை.", "நிறைய திரவம் கொடுங்கள் — தண்ணீர், தாய்ப்பால், சூப், ஓஆர்எஸ்.", "கனமான ஆடை வேண்டாம்; குளிர்ந்த நீரில் குளிப்பாட்ட வேண்டாம்.", "4–6 மணிக்கு ஒருமுறை வெப்பநிலை பார்த்து குறித்துக்கொள்ளுங்கள்.", "பெரும்பாலான வைரஸ் காய்ச்சலுக்கு ஆன்டிபயாடிக் தேவையில்லை."],
      hi: ["बुखार संक्रमण से लड़ने का शरीर का तरीका है। सिर्फ नंबर नहीं, बच्चे को देखें।", "बच्चा परेशान हो या बुखार 100.4°F (38°C) से ज़्यादा हो तो डॉक्टर की बताई खुराक में पैरासिटामॉल दें।", "हर 4–6 घंटे में 10–15 मि.ग्रा/किलो पैरासिटामॉल; 24 घंटे में ज़्यादा से ज़्यादा 4 खुराक।", "खूब तरल पदार्थ दें — पानी, माँ का दूध, सूप, ओआरएस।", "भारी कपड़े न पहनाएँ; ठंडे पानी से न नहलाएँ।", "हर 4–6 घंटे में बुखार नापकर लिखें।", "ज़्यादातर वायरल बुखार में एंटीबायोटिक की ज़रूरत नहीं होती।"] },
    dont: { en: ["Don't over-wrap the child or sponge with cold water — shivering pushes fever higher.", "Don't give aspirin, ibuprofen, or adult cold-and-flu medicines without advice.", "Don't wake a sleeping, comfortable child just to check the temperature."],
      ta: ["குழந்தையை போர்த்தி மூடவோ, குளிர்ந்த நீரில் துடைக்கவோ வேண்டாம் — நடுக்கம் காய்ச்சலை அதிகரிக்கும்.", "மருத்துவர் சொல்லாமல் ஆஸ்பிரின், இபுபுரூஃபன், பெரியவர் சளி-காய்ச்சல் மருந்து வேண்டாம்.", "நிம்மதியாக தூங்கும் குழந்தையை வெப்பம் பார்க்க எழுப்ப வேண்டாம்."],
      hi: ["बच्चे को ज़्यादा लपेटें नहीं, ठंडे पानी से पोंछें नहीं — कँपकँपी से बुखार बढ़ता है।", "बिना सलाह एस्पिरिन, इबुप्रोफेन या बड़ों की सर्दी-बुखार की दवा न दें।", "आराम से सोते बच्चे को सिर्फ बुखार नापने के लिए न जगाएँ।"] },
    expect: { en: "Fever often climbs in the evening for 2–3 days, then fades. Appetite returns last — keep fluids and light feeds going meanwhile.",
      ta: "2–3 நாட்கள் மாலையில் காய்ச்சல் ஏறி, பின் குறையும். பசி கடைசியாகத்தான் திரும்பும் — இடையில் திரவமும் இலகு உணவும் தொடருங்கள்.",
      hi: "2–3 दिन शाम को बुखार बढ़कर फिर घटता है। भूख सबसे आखिर में लौटती है — तब तक तरल पदार्थ और हल्का खाना जारी रखें।" },
    red: { en: "Return immediately: fits/seizure, unusually sleepy/limp, can't drink or breastfeed, vomits everything, breathing difficulty, rash with fever, fever >3 days, baby <3 months with fever.",
      ta: "உடனே வாருங்கள்: வலிப்பு, அதிக மயக்கம்/தளர்ச்சி, குடிக்க/பால் குடிக்க முடியாமை, எல்லாம் வாந்தி, மூச்சு சிரமம், காய்ச்சலுடன் தடிப்பு, 3 நாட்களுக்கு மேல் காய்ச்சல், 3 மாதத்திற்குட்பட்ட குழந்தைக்கு காய்ச்சல்.",
      hi: "तुरंत आएँ: दौरे/झटके, बहुत सुस्ती/ढीलापन, पी न पाना/दूध न पी पाना, सब कुछ उल्टी करना, साँस की तकलीफ, बुखार के साथ दाने, 3 दिन से ज़्यादा बुखार, 3 महीने से छोटे बच्चे को बुखार।" } },
  { id: "ors", icon: "💧", ors: true, title: { en: "Diarrhoea + ORS", ta: "வயிற்றுப்போக்கு + ஓஆர்எஸ்", hi: "दस्त + ओआरएस" },
    about: { en: "Most diarrhoea is viral and stops by itself in 3–5 days. The real danger is dehydration (water loss) — ORS replaces water and salts better than plain water.",
      ta: "பெரும்பாலான வயிற்றுப்போக்கு வைரஸால் வந்து 3–5 நாட்களில் தானே நிற்கும். உண்மையான ஆபத்து நீரிழப்பு — சாதாரண தண்ணீரை விட ஓஆர்எஸ் நீரையும் உப்பையும் சரியாக நிரப்பும்.",
      hi: "ज़्यादातर दस्त वायरल होते हैं और 3–5 दिन में खुद रुक जाते हैं। असली खतरा निर्जलीकरण (पानी की कमी) है — सादे पानी से बेहतर ओआरएस पानी और लवण दोनों देता है।" },
    bullets: {
      en: ["Start ORS from the first loose stool — small sips, often.", "Under 2 years: 50–100 mL after each stool. Above 2 years: 100–200 mL.", "Continue breastfeeding and normal feeds — do not starve the child.", "Give zinc (as prescribed) for 14 days.", "Check dehydration twice a day: very thirsty, sunken eyes, skin pinch that goes back slowly, or no urine — return the same day.", "Wash hands with soap; give safe boiled/cooled water.", "No anti-diarrhoeal syrups or antibiotics without advice."],
      ta: ["முதல் மலம் முதலே ஓஆர்எஸ் கொடுங்கள் — கொஞ்சம் கொஞ்சமாக, அடிக்கடி.", "2 வயதிற்குட்பட்டவருக்கு: ஒவ்வொரு மலத்திற்கும் 50–100 மி.லி. 2 வயதிற்கு மேல்: 100–200 மி.லி.", "தாய்ப்பால், சாதாரண உணவைத் தொடருங்கள் — பட்டினி போட வேண்டாம்.", "மருத்துவர் சொன்னபடி 14 நாட்கள் துத்தநாகம் (ஜிங்க்) கொடுங்கள்.", "தினம் 2 முறை நீரிழப்பு பாருங்கள்: அதிக தாகம், உள்ளே போன கண், கிள்ளிய தோல் மெதுவாக மீளுதல், சிறுநீர் இல்லை — அதே நாளில் வாருங்கள்.", "சோப்பால் கை கழுவுங்கள்; கொதித்து ஆறிய தண்ணீர் கொடுங்கள்.", "மருத்துவர் சொல்லாமல் வயிற்றுப்போக்கு மருந்து/ஆன்டிபயாடிக் வேண்டாம்."],
      hi: ["पहले ही पतले दस्त से ओआरएस शुरू करें — थोड़ा-थोड़ा, बार-बार।", "2 साल से छोटे: हर दस्त के बाद 50–100 मि.ली. 2 साल से बड़े: 100–200 मि.ली.", "माँ का दूध और सामान्य खाना जारी रखें — भूखा न रखें।", "डॉक्टर के बताए अनुसार 14 दिन तक ज़िंक दें।", "दिन में 2 बार निर्जलीकरण देखें: बहुत प्यास, धँसी आँखें, चिकोटी वाली खाल धीरे लौटना, पेशाब बंद — उसी दिन आएँ।", "साबुन से हाथ धुलवाएँ; उबला-ठंडा पानी दें।", "बिना सलाह दस्त रोकने की दवा/एंटीबायोटिक न दें।"] },
    dont: { en: ["Don't stop breastmilk or feeds — an empty stomach slows recovery.", "Don't give cola, packaged juice, or sports drinks — extra sugar worsens diarrhoea.", "Don't use anti-diarrhoeal or antibiotic syrups without the doctor's advice."],
      ta: ["தாய்ப்பால்/உணவை நிறுத்த வேண்டாம் — வெறும் வயிறு குணமாவதைத் தாமதிக்கும்.", "கோலா, பாக்கெட் ஜூஸ், விளையாட்டு பானம் வேண்டாம் — அதிக சர்க்கரை வயிற்றுப்போக்கை அதிகரிக்கும்.", "மருத்துவர் சொல்லாமல் வயிற்றுப்போக்கு/ஆன்டிபயாடிக் மருந்து வேண்டாம்."],
      hi: ["माँ का दूध या खाना बंद न करें — खाली पेट ठीक होने में देर करता है।", "कोला, पैकेट जूस, स्पोर्ट्स ड्रिंक न दें — ज़्यादा चीनी दस्त बढ़ाती है।", "बिना सलाह दस्त रोकने या एंटीबायोटिक की दवा न दें।"] },
    expect: { en: "Loose stools often continue 3–5 days even while the child improves. Judge hydration by urine and thirst, not by stool count.",
      ta: "குழந்தை தேறினாலும் 3–5 நாட்கள் மலம் இளகியே இருக்கலாம். மல எண்ணிக்கையால் அல்ல, சிறுநீர்-தாகத்தால் நீர்ச்சத்தை எடைபோடுங்கள்.",
      hi: "बच्चा सुधरते हुए भी 3–5 दिन दस्त पतले रह सकते हैं। दस्त की गिनती से नहीं, पेशाब और प्यास से पानी की कमी आँकें।" },
    red: { en: "Return immediately: blood in stool, repeated vomiting, very thirsty / no urine, sunken eyes, unusually sleepy, high fever.",
      ta: "உடனே வாருங்கள்: மலத்தில் ரத்தம், தொடர் வாந்தி, அதிக தாகம் / சிறுநீர் இல்லை, கண் உள்ளே போதல், அதிக மயக்கம், அதிக காய்ச்சல்.",
      hi: "तुरंत आएँ: दस्त में खून, बार-बार उल्टी, बहुत प्यास / पेशाब बंद, धँसी आँखें, बहुत सुस्ती, तेज़ बुखार।" } },
  { id: "vomit", icon: "🤮", title: { en: "Vomiting — home care", ta: "வாந்தி — வீட்டில் பராமரிப்பு", hi: "उल्टी — घर पर देखभाल" },
    about: { en: "Most vomiting comes from stomach viruses and stops within 24–48 hours. Small, frequent sips prevent dehydration far better than big glasses.",
      ta: "பெரும்பாலான வாந்தி வயிற்று வைரஸால் வந்து 24–48 மணியில் நிற்கும். பெரிய டம்ளரை விட சிறிது சிறிதாக அடிக்கடி கொடுப்பதே நீரிழப்பைத் தடுக்கும்.",
      hi: "ज़्यादातर उल्टी पेट के वायरस से होती है और 24–48 घंटे में रुक जाती है। बड़े गिलास से बेहतर थोड़ा-थोड़ा बार-बार पिलाना निर्जलीकरण रोकता है।" },
    bullets: {
      en: ["Wait 15–20 minutes after a vomit, then restart with small sips of ORS or water.", "Give 5–10 mL every 5–10 minutes; increase slowly if it stays down.", "Continue breastfeeding; restart light feeds (khichdi, curd rice, banana) once vomiting eases.", "Avoid fried, spicy food and full milk bottles for a day.", "Check urine: passing urine every 6–8 hours means hydration is okay."],
      ta: ["வாந்திக்குப் பின் 15–20 நிமிடம் நிறுத்தி, பின் ஓஆர்எஸ்/தண்ணீர் சிறிதாகக் கொடுங்கள்.", "5–10 நிமிடத்திற்கு 5–10 மி.லி; நிற்க ஆரம்பித்தால் மெதுவாக அதிகரியுங்கள்.", "தாய்ப்பால் தொடருங்கள்; வாந்தி குறைந்ததும் இலகு உணவு (கிச்சடி, தயிர் சாதம், வாழை) தொடங்குங்கள்.", "ஒரு நாள் பொரித்த/கார உணவு, நிறைய பால் பாட்டில் வேண்டாம்.", "சிறுநீர் பாருங்கள்: 6–8 மணிக்கு ஒருமுறை சிறுநீர் என்றால் நீர்ச்சத்து சரி."],
      hi: ["उल्टी के बाद 15–20 मिनट रुककर फिर ओआरएस/पानी थोड़ा-थोड़ा दें।", "हर 5–10 मिनट में 5–10 मि.ली; रुकने लगे तो धीरे-धीरे बढ़ाएँ।", "माँ का दूध जारी रखें; उल्टी घटने पर हल्का खाना (खिचड़ी, दही-चावल, केला) शुरू करें।", "एक दिन तला/मसालेदार खाना और भरी दूध की बोतल न दें।", "पेशाब देखें: हर 6–8 घंटे में पेशाब हो तो पानी ठीक है।"] },
    dont: { en: ["Don't force big glasses of water or juice right after vomiting — it triggers more.", "Don't give anti-vomiting or antibiotic syrups without advice.", "Don't lay a vomiting baby flat on the back — keep the head raised or side-lying."],
      ta: ["வாந்திக்கு உடனே பெரிய டம்ளர் தண்ணீர்/ஜூஸ் கட்டாயப்படுத்த வேண்டாம் — மீண்டும் வாந்தி வரும்.", "மருத்துவர் சொல்லாமல் வாந்தி/ஆன்டிபயாடிக் மருந்து வேண்டாம்.", "வாந்தி எடுக்கும் குழந்தையை மல்லாக்கப் படுக்க வைக்க வேண்டாம் — தலை உயர்த்தி/பக்கவாட்டில் வையுங்கள்."],
      hi: ["उल्टी के तुरंत बाद बड़े गिलास पानी/जूस ज़बरदस्ती न पिलाएँ — और उल्टी होगी।", "बिना सलाह उल्टी रोकने या एंटीबायोटिक की दवा न दें।", "उल्टी करते बच्चे को सीधा पीठ के बल न लिटाएँ — सिर ऊँचा या करवट रखें।"] },
    expect: { en: "Vomiting usually slows within 12–24 hours; loose stools may follow for a few days as the virus clears.",
      ta: "வாந்தி 12–24 மணியில் குறையும்; வைரஸ் வெளியேறும்போது சில நாள் இளகிய மலம் வரலாம்.",
      hi: "उल्टी 12–24 घंटे में घटती है; वायरस निकलते समय कुछ दिन पतले दस्त हो सकते हैं।" },
    red: { en: "Return immediately: blood or green colour in vomit, severe tummy pain, no urine >8 hours, unusually sleepy, vomiting >24 hours.",
      ta: "உடனே வாருங்கள்: வாந்தியில் ரத்தம்/பச்சை நிறம், கடும் வயிற்று வலி, 8 மணிக்கு மேல் சிறுநீர் இல்லை, அதிக மயக்கம், 24 மணிக்கு மேல் வாந்தி.",
      hi: "तुरंत आएँ: उल्टी में खून या हरा रंग, तेज़ पेट दर्द, 8 घंटे से पेशाब बंद, बहुत सुस्ती, 24 घंटे से ज़्यादा उल्टी।" } },
  { id: "cold", icon: "🤧", breath: true, title: { en: "Cold + cough", ta: "சளி + இருமல்", hi: "सर्दी + खाँसी" },
    about: { en: "Colds are caused by viruses and need 5–7 days to clear. Cough often lingers 1–2 weeks after the cold — a noisy cough alone is not chest infection.",
      ta: "சளி வைரஸால் வரும்; சரியாக 5–7 நாட்கள் ஆகும். சளி போன பின்னும் 1–2 வாரம் இருமல் நீடிக்கலாம் — சத்தமான இருமல் மட்டும் நுரையீரல் தொற்று அல்ல.",
      hi: "सर्दी वायरस से होती है और ठीक होने में 5–7 दिन लगते हैं। सर्दी के बाद भी 1–2 हफ़्ते खाँसी रह सकती है — सिर्फ आवाज़ वाली खाँसी छाती का संक्रमण नहीं है।" },
    bullets: {
      en: ["Most colds are viral and settle in 5–7 days.", "Saline nasal drops + steam ease a blocked nose.", "Continue breastfeeding/feeds; offer warm fluids.", "Honey (½ tsp) soothes cough above 1 year. No honey below 1 year.", "No cough syrups, antihistamines or antibiotics without advice.", "Keep the child away from smoke and dust."],
      ta: ["பெரும்பாலான சளி வைரஸால் வரும்; 5–7 நாட்களில் சரியாகும்.", "உப்பு நீர் மூக்கு சொட்டு + ஆவி பிடித்தல் அடைப்பைக் குறைக்கும்.", "தாய்ப்பால்/உணவைத் தொடருங்கள்; வெதுவெதுப்பான திரவம் கொடுங்கள்.", "1 வயதிற்கு மேல் ½ ஸ்பூன் தேன் இருமலைக் குறைக்கும். 1 வயதிற்குட்பட்ட குழந்தைக்கு தேன் வேண்டாம்.", "மருத்துவர் சொல்லாமல் இருமல் மருந்து/ஆன்டிபயாடிக் வேண்டாம்.", "புகை, தூசியிலிருந்து குழந்தையை விலக்கி வையுங்கள்."],
      hi: ["ज़्यादातर सर्दी वायरल होती है और 5–7 दिन में ठीक हो जाती है।", "नमकीन नाक की बूँदें + भाप बंद नाक खोलती हैं।", "माँ का दूध/खाना जारी रखें; गुनगुने तरल पदार्थ दें।", "1 साल के बाद ½ चम्मच शहद खाँसी में आराम देता है। 1 साल से छोटे को शहद न दें।", "बिना सलाह खाँसी की दवा/एंटीबायोटिक न दें।", "बच्चे को धुएँ और धूल से दूर रखें।"] },
    dont: { en: ["Don't give cough syrups, antihistamines, or antibiotics without advice.", "Don't use adult nasal sprays or apply balms inside a small baby's nostrils.", "Don't keep the child in closed, smoky rooms — fresh air helps recovery."],
      ta: ["மருத்துவர் சொல்லாமல் இருமல் மருந்து, ஒவ்வாமை மருந்து, ஆன்டிபயாடிக் வேண்டாம்.", "பெரியவர் மூக்கு ஸ்பிரே, குட்டி குழந்தை மூக்குக்குள் தைலம் வேண்டாம்.", "புகை நிறைந்த மூடிய அறையில் வைக்க வேண்டாம் — திறந்த காற்று நல்லது."],
      hi: ["बिना सलाह खाँसी की दवा, एलर्जी की दवा या एंटीबायोटिक न दें।", "बड़ों का नाक स्प्रे या छोटे बच्चे की नाक में बाम न लगाएँ।", "बच्चे को बंद, धुएँ वाले कमरे में न रखें — ताज़ा हवा फ़ायदेमंद है।"] },
    expect: { en: "Days 2–4 are usually the worst (blocked nose, broken sleep). Green nasal mucus alone does not mean antibiotics are needed.",
      ta: "2–4ம் நாள் மிகவும் சிரமம் (மூக்கடைப்பு, தூக்கக் கலக்கம்). பச்சை சளி மட்டும் ஆன்டிபயாடிக் தேவை என்று அர்த்தம் அல்ல.",
      hi: "दूसरे-चौथे दिन सबसे ज़्यादा तकलीफ़ होती है (बंद नाक, टूटी नींद)। सिर्फ हरे बलगम का मतलब एंटीबायोटिक नहीं है।" },
    red: { en: "Return immediately: fast breathing (see breath guide above), ribs pulling in, noisy in-breathing, blue lips, poor feeding, ear pain with fever.",
      ta: "உடனே வாருங்கள்: வேக மூச்சு (மேலே மூச்சு வழிகாட்டி பாருங்கள்), விலா உள்ளே இழுத்தல், மூச்சிழுக்கும்போது சத்தம், உதடு நீலம், பால் குடிக்க மறுத்தல், காய்ச்சலுடன் காது வலி.",
      hi: "तुरंत आएँ: तेज़ साँस (ऊपर साँस-मार्गदर्शिका देखें), पसलियाँ धँसना, साँस लेते समय आवाज़, नीले होंठ, दूध न पीना, बुखार के साथ कान दर्द।" } },
  { id: "shots", icon: "💉", title: { en: "After vaccination", ta: "தடுப்பூசி போட்ட பின்", hi: "टीका लगने के बाद" },
    about: { en: "Mild fever, pain, or a small lump after vaccines means the immune system is learning — a good sign. The BCG spot forms a tiny scar over weeks; that is normal too.",
      ta: "தடுப்பூசிக்குப் பின் லேசான காய்ச்சல், வலி, சிறு கட்டி — நோய் எதிர்ப்பு கற்றுக்கொள்கிறது என்று பொருள்; நல்ல அறிகுறி. பிசிஜி தழும்பு வாரங்களில் சிறு வடுவாகும்; அதுவும் சாதாரணம்.",
      hi: "टीके के बाद हल्का बुखार, दर्द या छोटी गाँठ का मतलब है रोग-प्रतिरोध सीख रहा है — अच्छा संकेत है। बीसीजी का निशान हफ़्तों में छोटे दाग़ में बदलता है; वह भी सामान्य है।" },
    bullets: {
      en: ["Mild fever, pain or swelling for 1–2 days is common and harmless.", "Give paracetamol only if the child is uncomfortable (dose as prescribed).", "Apply a clean cool cloth on a sore injection site.", "Continue normal feeds; let the child play.", "Note the next due date on the vaccine card — do not miss it."],
      ta: ["1–2 நாட்கள் லேசான காய்ச்சல், வலி, வீக்கம் சாதாரணம்; கவலை வேண்டாம்.", "குழந்தை சிரமப்பட்டால் மட்டும் மருத்துவர் சொன்னபடி பாராசிட்டமால் கொடுங்கள்.", "வலிக்கும் இடத்தில் சுத்தமான குளிர் துணி வையுங்கள்.", "சாதாரண உணவைத் தொடருங்கள்; குழந்தை விளையாடட்டும்.", "அடுத்த தடுப்பூசி தேதியை அட்டையில் குறித்து தவறாமல் வாருங்கள்."],
      hi: ["1–2 दिन हल्का बुखार, दर्द या सूजन आम है; चिंता न करें।", "बच्चा परेशान हो तभी डॉक्टर की बताई खुराक में पैरासिटामॉल दें।", "दर्द वाली जगह साफ ठंडा कपड़ा रखें।", "सामान्य खाना जारी रखें; बच्चे को खेलने दें।", "अगले टीके की तारीख कार्ड पर लिखकर ज़रूर आएँ।"] },
    dont: { en: ["Don't rub or press the injection site hard, or apply hot fomentation.", "Don't give paracetamol routinely 'to prevent fever' — only if the child is uncomfortable.", "Don't skip the next dose just because of mild fever this time."],
      ta: ["ஊசி போட்ட இடத்தை அழுத்தித் தேய்க்கவோ, சூடு ஒத்தடம் கொடுக்கவோ வேண்டாம்.", "'காய்ச்சல் வராமல்' முன்கூட்டியே பாராசிட்டமால் வேண்டாம் — சிரமப்பட்டால் மட்டும்.", "இம்முறை லேசான காய்ச்சல் என்பதால் அடுத்த தவணையைத் தவிர்க்க வேண்டாம்."],
      hi: ["टीके की जगह ज़ोर से मलें नहीं, गर्म सेंक न करें।", "'बुखार न आए' इसलिए पहले से पैरासिटामॉल न दें — परेशान हो तभी दें।", "इस बार हल्के बुखार के कारण अगली खुराक न छोड़ें।"] },
    expect: { en: "Fever or soreness peaks in the first 24 hours and settles by day 2. A BCG lump takes 3–6 weeks to become a tiny scar.",
      ta: "காய்ச்சல்/வலி முதல் 24 மணியில் உச்சம், 2ம் நாளில் சரியாகும். பிசிஜி கட்டி 3–6 வாரத்தில் சிறு வடுவாகும்.",
      hi: "बुखार/दर्द पहले 24 घंटों में सबसे ज़्यादा, दूसरे दिन तक ठीक। बीसीजी की गाँठ 3–6 हफ़्तों में छोटा दाग़ बनती है।" },
    red: { en: "Return immediately: crying >3 hours inconsolably, seizure, floppy/unresponsive episode, breathing difficulty, fast-spreading swelling.",
      ta: "உடனே வாருங்கள்: 3 மணிக்கு மேல் தொடர் அழுகை, வலிப்பு, தளர்ந்து/மயங்கும் நிலை, மூச்சு சிரமம், வேகமாகப் பரவும் வீக்கம்.",
      hi: "तुरंत आएँ: 3 घंटे से ज़्यादा लगातार रोना, दौरे, ढीला/बेहोश होना, साँस की तकलीफ, तेज़ी से फैलती सूजन।" } },
  { id: "solids", icon: "🍲", title: { en: "Complementary feeding (6–23 mo)", ta: "இணை உணவு (6–23 மாதம்)", hi: "पूरक आहार (6–23 माह)" },
    about: { en: "At 6 months (180 days) breastmilk alone can't meet iron, zinc and energy needs — family foods begin, while breastfeeding continues to 2 years. Food before 6 months harms; after 6 months, delay harms.",
      ta: "6 மாதத்தில் (180 நாள்) தாய்ப்பால் மட்டும் இரும்பு, துத்தநாகம், சக்தியைத் தராது — குடும்ப உணவு தொடங்கும், தாய்ப்பால் 2 வயது வரை தொடரும். 6க்கு முன் உணவு கேடு; 6க்குப் பின் தாமதம் கேடு.",
      hi: "6 माह (180 दिन) पर सिर्फ माँ का दूध लोहा, ज़िंक, ऊर्जा नहीं दे पाता — घर का खाना शुरू होता है, माँ का दूध 2 साल तक चलता है। 6 से पहले खाना नुकसान; 6 के बाद देरी नुकसान।" },
    pearl: { en: "🥄 Golden rule: thick enough to stay on the spoon, colourful enough to cover 4+ food groups a day.",
      ta: "🥄 பொன் விதி: ஸ்பூனில் நிற்கும் கெட்டி, நாளில் 4+ உணவுக் குழு நிறைந்த வண்ணம்.",
      hi: "🥄 सुनहरा नियम: चम्मच पर टिकने वाली गाढ़ापन, दिन में 4+ खाद्य-समूहों वाला रंग।" },
    chartTitle: { en: "🍽️ Day-wise meal plan", ta: "🍽️ நாள் உணவுத் திட்டம்", hi: "🍽️ दिन-भर भोजन-योजना" },
    chart: { head: { en: ["Age", "Meals/day", "How much", "Texture"], ta: ["வயது", "நாள் வேளை", "அளவு", "பதம்"], hi: ["उम्र", "दिन में बार", "मात्रा", "गाढ़ापन"] },
      rows: {
        en: [["6–8 mo", "2–3 + breastmilk", "2–3 tbsp → ½ katori", "Thick mash"], ["9–11 mo", "3–4 + 1–2 snacks", "½ katori (250 ml bowl)", "Chopped + finger foods"], ["12–23 mo", "3–4 + 1–2 snacks", "¾ to full katori", "Family foods"]],
        ta: [["6–8 மாதம்", "2–3 + தாய்ப்பால்", "2–3 ஸ்பூன் → ½ கிண்ணம்", "கெட்டி மசியல்"], ["9–11 மாதம்", "3–4 + 1–2 சிற்றுண்டி", "½ கிண்ணம் (250 மி.லி)", "நறுக்கியது + விரல் உணவு"], ["12–23 மாதம்", "3–4 + 1–2 சிற்றுண்டி", "¾ முதல் முழு கிண்ணம்", "குடும்ப உணவு"]],
        hi: [["6–8 माह", "2–3 + माँ का दूध", "2–3 चम्मच → ½ कटोरी", "गाढ़ा मसला"], ["9–11 माह", "3–4 + 1–2 नाश्ते", "½ कटोरी (250 मि.ली)", "कटा + उँगली-खाना"], ["12–23 माह", "3–4 + 1–2 नाश्ते", "¾ से पूरी कटोरी", "घर का खाना"]] } },
    bullets: {
      en: ["Start at 6 months: thick porridge/mash that stays on the spoon — thin gruel fills the stomach with water, not nutrition.", "Build every meal: staple (rice/ragi/wheat) + dal/egg/meat + vegetable/fruit + a spoon of oil/ghee.", "Animal-source foods daily — egg, fish, chicken or meat; fruits + vegetables daily; groundnut/til for energy.", "Increase texture with age: mash (6–8) → chopped + finger foods (9–11) → family foods (12+).", "Wash hands + utensils; cook fresh, serve warm; no bottles — use katori-spoon.", "During illness feed more often (soft favourites + extra breastfeeds); after illness give one extra meal daily for 2 weeks.", "Weigh monthly — the growth curve tells you feeding is working before eyes can."],
      ta: ["6 மாதத்தில் தொடங்குங்கள்: ஸ்பூனில் நிற்கும் கெட்டி கஞ்சி/மசியல் — நீர்த்த கஞ்சி வயிற்றை நீரால் நிரப்பும், சத்தால் அல்ல.", "ஒவ்வொரு வேளையும்: தானியம் (அரிசி/ராகி/கோதுமை) + பருப்பு/முட்டை/கறி + காய்/பழம் + ஒரு ஸ்பூன் எண்ணெய்/நெய்.", "தினம் அசைவம் — முட்டை, மீன், கோழி அல்லது கறி; தினம் காய் + பழம்; சக்திக்கு நிலக்கடலை/எள்.", "வயதுடன் பதம் கூட்டுங்கள்: மசியல் (6–8) → நறுக்கியது + விரல் உணவு (9–11) → குடும்ப உணவு (12+).", "கை + பாத்திரம் கழுவுங்கள்; புதிதாகச் சமைத்து இதமாகப் பரிமாறுங்கள்; பாட்டில் வேண்டாம் — கிண்ணம்-ஸ்பூன்.", "நோயில் அடிக்கடி ஊட்டுங்கள் (மென் பிடித்த உணவு + கூடுதல் தாய்ப்பால்); நோய்க்குப் பின் 2 வாரம் தினம் ஒரு வேளை கூடுதல்.", "மாதம் எடை பாருங்கள் — கண்ணுக்குத் தெரியுமுன் வளர்ச்சிக் கோடு உணவு பலனைக் காட்டும்."],
      hi: ["6 माह पर शुरू करें: चम्मच पर टिकने वाला गाढ़ा दलिया/मसला — पतली घाट पेट पानी से भरती है, पोषण से नहीं।", "हर बार थाली बनाएँ: अनाज (चावल/रागी/गेहूँ) + दाल/अंडा/मांस + सब्ज़ी/फल + एक चम्मच तेल/घी।", "रोज़ प्राणी-आहार — अंडा, मछली, चिकन या मांस; रोज़ सब्ज़ी + फल; ताकत के लिए मूँगफली/तिल।", "उम्र के साथ गाढ़ापन बढ़ाएँ: मसला (6–8) → कटा + उँगली-खाना (9–11) → घर का खाना (12+)।", "हाथ + बर्तन धोएँ; ताज़ा पकाकर गुनगुना परोसें; बोतल नहीं — कटोरी-चम्मच।", "बीमारी में बार-बार खिलाएँ (नरम पसंदीदा + ज़्यादा माँ का दूध); बीमारी के बाद 2 हफ़्ते रोज़ एक बार ज़्यादा।", "महीने में तौलें — आँखों से पहले बढ़त-रेखा बताएगी खाना काम कर रहा है।"] },
    dont: { en: ["Don't force-feed or distract-feed with a phone/TV — it spoils hunger cues and bonding.", "Don't give honey, cow's milk as a main drink, tea/coffee, cola, or packaged juices in year one — and no added salt/sugar before 1 year.", "Don't delay textures past 9 months — late chewing slows speech muscles too."],
      ta: ["கட்டாயப்படுத்தி/போன்-டிவி காட்டி ஊட்ட வேண்டாம் — பசி உணர்வு, பாசம் கெடும்.", "முதல் வருடம் தேன், பசும்பால் (முக்கிய பானம்), டீ/காபி, கோலா, பாக்கெட் ஜூஸ் வேண்டாம் — 1 வயதுக்குள் உப்பு/சர்க்கரை சேர்க்க வேண்டாம்.", "9 மாதத்திற்குப் பின் பதத்தைத் தள்ளிப்போட வேண்டாம் — தாமத மெல்லல் பேச்சுத் தசையையும் தாமதிக்கும்."],
      hi: ["ज़बरदस्ती/फ़ोन-टीवी दिखाकर न खिलाएँ — भूख का अहसास और अपनापन बिगड़ता है।", "पहले साल शहद, गाय का दूध (मुख्य पेय), चाय/कॉफ़ी, कोला, पैकेट जूस नहीं — 1 साल से पहले नमक/चीनी न मिलाएँ।", "9 माह के बाद गाढ़ेपन में देर न करें — देर से चबाना बोलने की मांसपेशी भी देर कराता है।"] },
    expect: { en: "New foods may be refused 8–10 times before acceptance — offer, don't push. Appetite dips around 12–15 months — small frequent meals win. Non-breastfed babies need 4–5 small meals a day.",
      ta: "புது உணவு 8–10 முறை மறுக்கப்படலாம் — கொடுங்கள், திணிக்க வேண்டாம். 12–15 மாதத்தில் பசி குறையும் — சிறு அடிக்கடி வேளைகளே வெல்லும். தாய்ப்பால் இல்லாக் குழந்தைக்கு நாளில் 4–5 சிறு வேளை தேவை.",
      hi: "नया खाना 8–10 बार ठुकराया जा सकता है — देते रहें, ठूसें नहीं। 12–15 माह में भूख घटती है — छोटे बार-बार के भोजन जीतते हैं। माँ का दूध न पीने वाले को दिन में 4–5 छोटे भोजन चाहिए।" },
    red: { en: "Discuss with doctor: poor weight gain, frequent vomiting, blood in stool, food refusal >2 weeks.",
      ta: "மருத்துவரிடம் பேசுங்கள்: எடை கூடாமை, அடிக்கடி வாந்தி, மலத்தில் ரத்தம், 2 வாரத்திற்கு மேல் உணவு மறுப்பு.",
      hi: "डॉक्टर से बात करें: वज़न न बढ़ना, बार-बार उल्टी, दस्त में खून, 2 हफ़्ते से ज़्यादा खाना न खाना।" } },
  { id: "play", icon: "🧸", play: true, title: { en: "Play prescription", ta: "விளையாட்டு மருந்துச்சீட்டு", hi: "खेल परामर्श" },
    about: { en: "Play is how young brains grow — 15 focused minutes with you beats hours of passive screen time. Follow the band for your child's age.",
      ta: "விளையாட்டே இளம் மூளையின் வளர்ச்சி — உங்களுடன் 15 நிமிட கவன விளையாட்டு, மணிக்கணக்கான திரை நேரத்தை விடச் சிறந்தது. குழந்தை வயதுப் பிரிவைப் பின்பற்றுங்கள்.",
      hi: "खेल से छोटा दिमाग़ बढ़ता है — आपके साथ 15 मिनट का ध्यान-खेल घंटों के निष्क्रिय स्क्रीन से बेहतर है। बच्चे की उम्र वाले भाग का पालन करें।" },
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
const HAND_GRP_LBL = { care: "🩺 Everyday care", hb: "📖 Infant Feeding Handbook" };
const HAND_LINK_TXT = { en: "Read the full illustrated chapter", ta: "முழு விளக்கப் பகுதியைப் படியுங்கள்", hi: "पूरा चित्रित अध्याय पढ़ें" };
const HAND_SEL = { h: "fever", lang: "en" };
function handSec(title, color, inner, tint) {
  return `<div style="margin:10px 0;background:${tint};border-left:4px solid ${color};border-radius:10px;padding:8px 12px"><div style="font-size:13px;font-weight:800;color:${color};letter-spacing:.3px;margin-bottom:4px">${esc(title)}</div><div style="font-size:14px;line-height:1.7">${inner}</div></div>`;
}
function handChart(title, head, rows) {
  return `<div style="margin:10px 0"><div style="font-size:13px;font-weight:800;color:var(--teal-d,#0b7c72);margin-bottom:5px">${esc(title)}</div>
  <div style="overflow:auto"><table class="tbl" style="margin:0"><tr>${head.map((c) => `<th style="background:var(--teal,#0e8f84);color:#fff;border-color:var(--teal,#0e8f84)">${esc(c)}</th>`).join("")}</tr>
  ${rows.map((r, i) => `<tr${i % 2 ? ' style="background:#f0fdfa"' : ""}>${r.map((c, j) => j === 0 ? `<td><b>${esc(c)}</b></td>` : `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div></div>`;
}
function handLetterhead(c) {
  const S = (typeof DB !== "undefined" && DB.settings) || {};
  const doc = ((typeof DB !== "undefined" && DB.doctors) || []).find((d) => d.id === S.docId) || ((typeof DB !== "undefined" && DB.doctors) || [])[0];
  const docLine = doc ? [doc.name, doc.qual].filter(Boolean).join(", ") : (S.doctor || "");
  let wt = "";
  try { const lm = c && typeof latestMeasure === "function" ? latestMeasure(c) : null; if (lm && lm.wt) wt = ` · ${lm.wt} kg`; } catch (e) {}
  return `<div style="display:flex;gap:10px;align-items:center;border-bottom:2px solid var(--teal);padding-bottom:8px;margin-bottom:8px">
    <div style="font-size:34px;line-height:1">${S.logo ? `<img src="${S.logo}" alt="" style="width:44px;height:44px;object-fit:contain">` : "👶"}</div>
    <div style="flex:1"><div style="font-size:17px;font-weight:800">${esc(S.clinic || "Clinic")}</div>
    <div style="font-size:12.5px;color:var(--muted)">${esc(docLine)}${S.addr ? ` · ${esc(S.addr)}` : ""}</div></div>
    <div style="font-size:12px;color:var(--muted);text-align:right">PARENT HANDOUT<br>${esc(fmtDate(typeof todayISO === "function" ? todayISO() : ""))}</div></div>
  ${c ? `<div style="font-size:13px;margin-bottom:2px"><b>${esc(c.name)}</b> · ${esc(typeof ageStr === "function" ? ageStr(ageBetween(c.dob)) : "")}${wt}</div>` : ""}`;
}
function renderHand() {
  if (!$("pg-hand")) return;
  const c = child();
  const h = HANDOUTS.find((x) => x.id === HAND_SEL.h) || HANDOUTS[0];
  const L = HAND_SEL.lang;
  let sub = "", bullets = h.bullets ? h.bullets[L] : [], red = h.red ? h.red[L] : "";
  if (h.play && c) {
    const ab = ageBetween(c.dob), ageM = ab.y * 12 + ab.m;
    const band = playPick(ageM);
    sub = ` · ${band.label[L]} (auto by age)`;
    bullets = band.bullets[L];
  }
  let strip = "";
  if ((h.dose || h.ors) && c) {
    try {
      const lm = latestMeasure(c);
      if (lm && +lm.wt > 0) {
        if (h.dose) { const d = handDose(+lm.wt); strip = `<div class="alert a-amber" style="margin:8px 0">${HAND_DOSE_TXT[L](c.name, lm.wt, d.mg, d.syrup, d.drops)}</div>`; }
        if (h.ors) { strip = `<div class="alert a-amber" style="margin:8px 0">${HAND_ORS_TXT[L](c.name, lm.wt, handOrs(+lm.wt))}</div>`; }
      }
    } catch (e) {}
  }
  const breath = h.breath ? `<div class="alert a-blue" style="margin:8px 0">${HAND_BREATH[L]}</div>` : "";
  const pearl = h.pearl ? `<div style="margin:8px 0;background:#fff8e1;border:1px solid #d4a017;border-radius:10px;padding:8px 12px;font-size:13.5px"><b>${esc(h.pearl[L])}</b></div>` : "";
  const chart = h.chart ? handChart(h.chartTitle[L], h.chart.head[L], h.chart.rows[L]) : "";
  const fulllink = h.link ? `<div class="no-print" style="margin:6px 0"><a class="btn btn-o btn-sm" href="${esc(h.link)}" target="_blank" rel="noopener">📖 ${esc(HAND_LINK_TXT[L])}</a></div>` : "";
  const about = h.about ? handSec(HAND_SECLBL.about[L], "var(--teal-d,#0b7c72)", esc(h.about[L]), "#eefbf7") : "";
  const dos = bullets.length ? handSec(HAND_SECLBL.do[L], "#15803d", `<ol style="margin:0;padding-left:20px">${bullets.map((b) => `<li style="margin:3px 0">${esc(b)}</li>`).join("")}</ol>`, "#f0fdf4") : "";
  const donts = h.dont ? handSec(HAND_SECLBL.dont[L], "#b91c1c", `<ul style="margin:0;padding-left:20px;list-style:'✕  '">${h.dont[L].map((b) => `<li style="margin:3px 0">${esc(b)}</li>`).join("")}</ul>`, "#fef2f2") : "";
  const exp = h.expect ? handSec(HAND_SECLBL.expect[L], "#b45309", esc(h.expect[L]), "#fffbeb") : "";
  $("handBox").innerHTML = `
  <div class="toolbar no-print">
    <select onchange="HAND_SEL.h=this.value;renderHand()" style="max-width:260px"><optgroup label="${HAND_GRP_LBL.care}">${HANDOUTS.filter((x) => !x.grp).map((x) => `<option value="${x.id}"${x.id === h.id ? " selected" : ""}>${x.icon} ${esc(x.title.en)}</option>`).join("")}</optgroup>${HANDOUTS.some((x) => x.grp === "hb") ? `<optgroup label="${HAND_GRP_LBL.hb}">${HANDOUTS.filter((x) => x.grp === "hb").map((x) => `<option value="${x.id}"${x.id === h.id ? " selected" : ""}>${x.icon} ${esc(x.title.en)}</option>`).join("")}</optgroup>` : ""}</select>
    <select onchange="HAND_SEL.lang=this.value;renderHand()" style="max-width:140px">${Object.keys(HAND_LANGS).map((k) => `<option value="${k}"${k === L ? " selected" : ""}>${HAND_LANGS[k]}</option>`).join("")}</select>
    <span class="sp"></span><button class="btn btn-o btn-sm" onclick="printPage('pg-hand')">🖨️ Print handout</button>
  </div>
  <div class="vaxcard" style="max-width:680px;margin:0 auto">
    ${handLetterhead(c)}
    <div style="font-size:11px;letter-spacing:1px;color:var(--muted);font-weight:800">PARENT HANDOUT · ${esc(HAND_LANGS[L]).toUpperCase()}</div>
    <h2 style="margin:2px 0 4px">${h.icon} ${esc(h.title[L])}${esc(sub)}</h2>
    ${fulllink}${about}${pearl}${strip}${breath}${chart}${dos}${donts}${exp}
    ${red ? `<div class="alert a-red" style="margin:10px 0 0">🚨 <div><b>${esc(red)}</b></div></div>` : ""}
    <div style="font-size:11.5px;color:var(--muted);margin-top:10px;border-top:1px dashed var(--line);padding-top:6px">${esc(HAND_SECLBL.foot[L])}</div>
  </div>`;
}
