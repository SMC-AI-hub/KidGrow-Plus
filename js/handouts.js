/* =====================================================
   KidGrow Pro — Parent handouts EN / TA / HI (Round 4)
   Rich format (v10.11.2): what's happening · numbered
   do-steps · don't-myths · what to expect · red flags ·
   weight-based paracetamol strip · clinic letterhead.
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
function handDose(wt) {
  const mg = Math.round(wt * 15), r1 = (x) => Math.round(x * 10) / 10;
  return { mg, syrup: r1(mg / 24), drops: r1(mg / 100) };
}
const HANDOUTS = [
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
    red: { en: "Return immediately: fits/seizure, unusually sleepy or limp, breathing difficulty, rash with fever, fever >3 days, baby <3 months with fever.",
      ta: "உடனே வாருங்கள்: வலிப்பு, அதிக மயக்கம்/தளர்ச்சி, மூச்சு சிரமம், காய்ச்சலுடன் தடிப்பு, 3 நாட்களுக்கு மேல் காய்ச்சல், 3 மாதத்திற்குட்பட்ட குழந்தைக்கு காய்ச்சல்.",
      hi: "तुरंत आएँ: दौरे/झटके, बहुत सुस्ती या ढीलापन, साँस लेने में तकलीफ, बुखार के साथ दाने, 3 दिन से ज़्यादा बुखार, 3 महीने से छोटे बच्चे को बुखार।" } },
  { id: "ors", icon: "💧", title: { en: "Diarrhoea + ORS", ta: "வயிற்றுப்போக்கு + ஓஆர்எஸ்", hi: "दस्त + ओआरएस" },
    about: { en: "Most diarrhoea is viral and stops by itself in 3–5 days. The real danger is dehydration (water loss) — ORS replaces water and salts better than plain water.",
      ta: "பெரும்பாலான வயிற்றுப்போக்கு வைரஸால் வந்து 3–5 நாட்களில் தானே நிற்கும். உண்மையான ஆபத்து நீரிழப்பு — சாதாரண தண்ணீரை விட ஓஆர்எஸ் நீரையும் உப்பையும் சரியாக நிரப்பும்.",
      hi: "ज़्यादातर दस्त वायरल होते हैं और 3–5 दिन में खुद रुक जाते हैं। असली खतरा निर्जलीकरण (पानी की कमी) है — सादे पानी से बेहतर ओआरएस पानी और लवण दोनों देता है।" },
    bullets: {
      en: ["Start ORS from the first loose stool — small sips, often.", "Under 2 years: 50–100 mL after each stool. Above 2 years: 100–200 mL.", "Continue breastfeeding and normal feeds — do not starve the child.", "Give zinc (as prescribed) for 14 days.", "Wash hands with soap; give safe boiled/cooled water.", "No anti-diarrhoeal syrups or antibiotics without advice."],
      ta: ["முதல் மலம் முதலே ஓஆர்எஸ் கொடுங்கள் — கொஞ்சம் கொஞ்சமாக, அடிக்கடி.", "2 வயதிற்குட்பட்டவருக்கு: ஒவ்வொரு மலத்திற்கும் 50–100 மி.லி. 2 வயதிற்கு மேல்: 100–200 மி.லி.", "தாய்ப்பால், சாதாரண உணவைத் தொடருங்கள் — பட்டினி போட வேண்டாம்.", "மருத்துவர் சொன்னபடி 14 நாட்கள் துத்தநாகம் (ஜிங்க்) கொடுங்கள்.", "சோப்பால் கை கழுவுங்கள்; கொதித்து ஆறிய தண்ணீர் கொடுங்கள்.", "மருத்துவர் சொல்லாமல் வயிற்றுப்போக்கு மருந்து/ஆன்டிபயாடிக் வேண்டாம்."],
      hi: ["पहले ही पतले दस्त से ओआरएस शुरू करें — थोड़ा-थोड़ा, बार-बार।", "2 साल से छोटे: हर दस्त के बाद 50–100 मि.ली. 2 साल से बड़े: 100–200 मि.ली.", "माँ का दूध और सामान्य खाना जारी रखें — भूखा न रखें।", "डॉक्टर के बताए अनुसार 14 दिन तक ज़िंक दें।", "साबुन से हाथ धुलवाएँ; उबला-ठंडा पानी दें।", "बिना सलाह दस्त रोकने की दवा/एंटीबायोटिक न दें।"] },
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
  { id: "cold", icon: "🤧", title: { en: "Cold + cough", ta: "சளி + இருமல்", hi: "सर्दी + खाँसी" },
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
    red: { en: "Return immediately: fast/noisy breathing, ribs pulling in, blue lips, poor feeding, ear pain with fever.",
      ta: "உடனே வாருங்கள்: வேகமான/சத்தமான மூச்சு, விலா எலும்பு உள்ளே இழுத்தல், உதடு நீலம், பால் குடிக்க மறுத்தல், காய்ச்சலுடன் காது வலி.",
      hi: "तुरंत आएँ: तेज़/आवाज़ वाली साँस, पसलियाँ धँसना, नीले होंठ, दूध न पीना, बुखार के साथ कान दर्द।" } },
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
  { id: "solids", icon: "🥣", title: { en: "Starting solids (~6 mo)", ta: "இணை உணவு (~6 மாதம்)", hi: "ऊपर का खाना (~6 माह)" },
    about: { en: "Around 6 months, breastmilk alone can't meet iron and energy needs — that's why family foods begin. Breastmilk continues alongside until 2 years.",
      ta: "6 மாதத்தில் தாய்ப்பால் மட்டும் இரும்பு, சக்தித் தேவையை ஈடு செய்யாது — அதனால்தான் குடும்ப உணவு தொடங்கும். தாய்ப்பால் 2 வயது வரை தொடரும்.",
      hi: "6 माह के आसपास सिर्फ माँ का दूध लोहे और ऊर्जा की ज़रूरत पूरी नहीं करता — इसलिए घर का खाना शुरू होता है। माँ का दूध 2 साल तक साथ चलता है।" },
    bullets: {
      en: ["Start around 6 months; breastmilk continues to 2 years.", "Begin with 2–3 spoonfuls once a day; increase slowly.", "First foods: rice porridge, ragi, mashed banana, dal → khichdi.", "Add a spoon of oil/ghee + mashed groundnut/egg (if taken) for energy.", "No honey, cow's milk as drink, tea, or junk food in year one.", "Try each new food for 3 days; watch for allergy."],
      ta: ["6 மாதத்தில் தொடங்குங்கள்; தாய்ப்பால் 2 வயது வரை தொடரும்.", "முதலில் 2–3 ஸ்பூன், ஒரு வேளை; மெதுவாக அதிகரியுங்கள்.", "முதல் உணவு: அரிசி கஞ்சி, ராகி, வாழைப்பழம், பருப்பு → கிச்சடி.", "சக்திக்கு ஒரு ஸ்பூன் எண்ணெய்/நெய், அரைத்த நிலக்கடலை/முட்டை (சாப்பிட்டால்).", "முதல் வருடம் தேன், பசும்பால் (குடிக்க), டீ, துரித உணவு வேண்டாம்.", "புது உணவை 3 நாள் கொடுத்து ஒவ்வாமை பாருங்கள்."],
      hi: ["6 माह के आसपास शुरू करें; माँ का दूध 2 साल तक जारी रखें।", "पहले 2–3 चम्मच, दिन में एक बार; धीरे-धीरे बढ़ाएँ।", "पहले खाद्य: चावल का दलिया, रागी, मसला केला, दाल → खिचड़ी।", "ताकत के लिए एक चम्मच तेल/घी, पिसी मूँगफली/अंडा (खाते हों तो)।", "पहले साल शहद, गाय का दूध (पीने को), चाय, जंक फूड नहीं।", "नया खाना 3 दिन देकर एलर्जी देखें।"] },
    dont: { en: ["Don't force-feed or distract-feed with a phone/TV screen — it spoils hunger cues.", "Don't give honey, cow's milk as a main drink, tea, or packaged juices in year one.", "Don't delay textures — soft finger foods by 8–9 months build chewing and speech."],
      ta: ["கட்டாயப்படுத்தி ஊட்டவோ, போன்/டிவி காட்டி ஊட்டவோ வேண்டாம் — பசி உணர்வு கெடும்.", "முதல் வருடம் தேன், பசும்பால் (முக்கிய பானமாக), டீ, பாக்கெட் ஜூஸ் வேண்டாம்.", "கடின உணவைத் தள்ளிப்போட வேண்டாம் — 8–9 மாதத்தில் மென் விரல் உணவு மெல்லல், பேச்சுக்கு உதவும்."],
      hi: ["ज़बरदस्ती न खिलाएँ, फ़ोन/टीवी दिखाकर न खिलाएँ — भूख का अहसास बिगड़ता है।", "पहले साल शहद, गाय का दूध (मुख्य पेय), चाय, पैकेट जूस नहीं।", "नरम-सख़्त खाने में देर न करें — 8–9 माह तक उँगली-खाना चबाने और बोलने में मदद करता है।"] },
    expect: { en: "Babies may refuse a new food 8–10 times before accepting it — keep offering without pressure. Mess is part of learning.",
      ta: "புது உணவை 8–10 முறை மறுத்த பின்தான் குழந்தை ஏற்கலாம் — அழுத்தமின்றி தொடர்ந்து கொடுங்கள். அள்ளிறைத்தல் கற்றலின் பகுதி.",
      hi: "बच्चा नया खाना 8–10 बार ठुकराकर फिर स्वीकार सकता है — बिना दबाव देते रहें। फैलाना सीखने का हिस्सा है।" },
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
const HAND_SEL = { h: "fever", lang: "en" };
function handSec(title, color, inner) {
  return `<div style="margin:10px 0"><div style="font-size:13px;font-weight:800;color:${color};letter-spacing:.3px;margin-bottom:4px">${esc(title)}</div><div style="font-size:14px;line-height:1.7">${inner}</div></div>`;
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
  let dose = "";
  if (h.dose && c) {
    try {
      const lm = latestMeasure(c);
      if (lm && +lm.wt > 0) { const d = handDose(+lm.wt); dose = `<div class="alert a-amber" style="margin:8px 0">${HAND_DOSE_TXT[L](c.name, lm.wt, d.mg, d.syrup, d.drops)}</div>`; }
    } catch (e) {}
  }
  const about = h.about ? handSec(HAND_SECLBL.about[L], "var(--teal-d,#0b7c72)", esc(h.about[L])) : "";
  const dos = bullets.length ? handSec(HAND_SECLBL.do[L], "#15803d", `<ol style="margin:0;padding-left:20px">${bullets.map((b) => `<li style="margin:3px 0">${esc(b)}</li>`).join("")}</ol>`) : "";
  const donts = h.dont ? handSec(HAND_SECLBL.dont[L], "#b91c1c", `<ul style="margin:0;padding-left:20px;list-style:'✕  '">${h.dont[L].map((b) => `<li style="margin:3px 0">${esc(b)}</li>`).join("")}</ul>`) : "";
  const exp = h.expect ? handSec(HAND_SECLBL.expect[L], "#b45309", esc(h.expect[L])) : "";
  $("handBox").innerHTML = `
  <div class="toolbar no-print">
    <select onchange="HAND_SEL.h=this.value;renderHand()" style="max-width:220px">${HANDOUTS.map((x) => `<option value="${x.id}"${x.id === h.id ? " selected" : ""}>${x.icon} ${esc(x.title.en)}</option>`).join("")}</select>
    <select onchange="HAND_SEL.lang=this.value;renderHand()" style="max-width:140px">${Object.keys(HAND_LANGS).map((k) => `<option value="${k}"${k === L ? " selected" : ""}>${HAND_LANGS[k]}</option>`).join("")}</select>
    <span class="sp"></span><button class="btn btn-o btn-sm" onclick="printPage('pg-hand')">🖨️ Print handout</button>
  </div>
  <div class="vaxcard" style="max-width:680px;margin:0 auto">
    ${handLetterhead(c)}
    <div style="font-size:11px;letter-spacing:1px;color:var(--muted);font-weight:800">PARENT HANDOUT · ${esc(HAND_LANGS[L]).toUpperCase()}</div>
    <h2 style="margin:2px 0 4px">${h.icon} ${esc(h.title[L])}${esc(sub)}</h2>
    ${about}${dose}${dos}${donts}${exp}
    ${red ? `<div class="alert a-red" style="margin:10px 0 0">🚨 <div><b>${esc(red)}</b></div></div>` : ""}
    <div style="font-size:11.5px;color:var(--muted);margin-top:10px;border-top:1px dashed var(--line);padding-top:6px">${esc(HAND_SECLBL.foot[L])}</div>
  </div>`;
}
