"""Generates backend/data/messages.csv: labelled SYNTHETIC scam and legitimate messages.

Run:  python data/generate_messages.py
Deterministic (fixed seed). Every name, number, company and link is made up; the domains are
fictional and must never be opened. Tamil rows are machine-assisted (TODO: native-speaker review).

Columns: text, label (scam|legit), scam_type, language, channel, difficulty (easy|hard|adversarial),
template_family. `template_family` groups all variants of one template so train/test splits never
put near-duplicates on both sides.
"""

import csv
import random
from pathlib import Path

rng = random.Random(42)
OUT = Path(__file__).with_name("messages.csv")

SLOTS = {
    "name": ["Mr Lim", "Ms Tan", "Officer Wong", "Inspector Lee", "Mr Ng", "Ms Chua", "Mr Goh", "Ms Teo", "Mr Rahman", "Ms Devi"],
    "amount": ["$500", "$1,200", "$3,000", "$8,000", "$15,000", "$250", "$2,500", "$6,800", "$4,200", "$950"],
    "small": ["$1.99", "$2.50", "$3.20", "$1.50", "$4.80", "$2.90"],
    "domain": ["sg-parcel-track.info", "mas-verify.top", "ocbc-secure-login.xyz", "singpost-redeliver.cc", "ica-check.online",
               "dbs-refund.click", "concert-tix-sg.shop", "job-hub-sg.work", "promo-win-sg.win", "police-gov-sg.live",
               "uob-alert.icu", "sgpass-verify.top", "bit.ly/3xQz9k", "tinyurl.com/sg-refund"],
    "day": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "artist": ["Taylor", "Coldplay", "Jay Chou", "BLACKPINK", "Ed Sheeran", "Mayday"],
    "game": ["Genshin", "Mobile Legends", "Valorant", "Roblox", "PUBG"],
    "month": ["January", "March", "May", "July", "September", "November"],
    "company": ["Brightway Logistics", "Nova Retail", "Kestrel Media", "Harbour Foods", "Lumen Tech"],
    "item": ["iPhone 16 Pro", "PS5", "Dyson vacuum", "Nintendo Switch", "MacBook Air", "Pokemon booster box"],
    "num": ["8123 4567", "9345 6712", "+63 917 555 0142", "+44 7700 900123", "3158 2290", "6212 3344"],
    "pct": ["20%", "30%", "45%", "8%", "15%"],
}

# (template, channel, difficulty). One list per scam type and language.
SCAM = {
    "government_official": {
        "en": [
            ("This is {name} from the Monetary Authority of Singapore. Your bank account is linked to money laundering. Transfer your savings to the MAS safety account immediately.", "call", "easy"),
            ("URGENT: {name} from Singapore Police Force. A warrant has been issued in your name. Do not tell anyone. Move {amount} to a safe account to clear your name.", "sms", "easy"),
            ("Ministry of Law notice: your identity was used in a criminal case. Stay on the line, I will transfer your call to the police. Keep this confidential.", "call", "easy"),
            ("ICA officer here. Your passport was used to send illegal parcels. Hand over your gold and cash to our officer for investigation. Tell no one.", "call", "easy"),
            ("Court notice: you have a pending case. Pay {amount} within 24 hours or a warrant of arrest will be issued. Reply now.", "sms", "easy"),
            ("Inspector {name}: your account will be frozen today. Transfer funds to the holding account I give you. This call is secret, do not hang up.", "call", "easy"),
            ("You are under investigation for money laundering. Install the app from {domain} so we can check your phone. Do not tell the bank staff.", "whatsapp", "easy"),
            ("MAS here. To protect your money, take a loan of {amount} and pass the cash to our courier. Do not inform your family.", "call", "hard"),
        ],
        "zh": [("您好，我是新加坡金融管理局的官员{name}。您的账户涉及洗钱，请马上把钱转到安全账户，不要告诉家人。", "call", "easy"),
               ("警察局通知：您涉及刑事案件，已发出逮捕令。请保密并立即转账{amount}到指定账户。", "sms", "easy"),
               ("移民局：您的护照涉嫌非法活动，请交出现金和黄金给我们的官员调查，切勿告诉任何人。", "call", "easy")],
        "ms": [("Ini pegawai MAS. Akaun anda terlibat dengan pengubahan wang haram. Pindahkan wang ke akaun selamat sekarang. Jangan beritahu sesiapa.", "call", "easy"),
               ("Polis: waran tangkap telah dikeluarkan atas nama anda. Bayar {amount} segera dan rahsiakan perkara ini.", "sms", "easy")],
        "ta": [("நான் காவல்துறை அதிகாரி {name}. உங்கள் கணக்கு பணமோசடியில் தொடர்புடையது. உடனே பணத்தை பாதுகாப்பான கணக்கிற்கு மாற்றுங்கள். யாரிடமும் சொல்ல வேண்டாம்.", "call", "easy")],
    },
    "fake_friend": {
        "en": [
            ("Hi Mum, this is my new number. My phone broke. Can you transfer {amount} to my friend's account? Urgent, I'll explain later.", "whatsapp", "easy"),
            ("Hey it's me, lost my phone. Using this new number. Need {amount} urgently for hospital bill, please PayNow now, can't talk now.", "sms", "easy"),
            ("Guess who? Haha it's me la, changed number. Can help me pay {amount} to this account first? Bank app got problem, urgent.", "whatsapp", "easy"),
            ("Uncle, remember me? I'm in trouble overseas. Please send {amount} to this account today, don't tell anyone.", "call", "easy"),
            ("Grandma, I got arrested and need {amount} bail money now. Please keep it secret from my parents.", "call", "easy"),
            ("Bro this is my new number, save it. Can lend me {amount}? PayNow to {num}, will return tomorrow, very urgent.", "whatsapp", "hard"),
        ],
        "zh": [("妈，我换了新号码，手机坏了。急需{amount}，请马上转账给我朋友，不要打电话。", "whatsapp", "easy"),
               ("猜猜我是谁？我换了新号码。现在有急事，可以先借我{amount}吗？马上转账到这个户口。", "call", "easy")],
        "ms": [("Mak, ini nombor baru saya. Telefon rosak. Tolong pindahkan {amount} segera, jangan telefon.", "whatsapp", "easy")],
        "ta": [("அம்மா, இது என் புதிய எண். என் போன் உடைந்துவிட்டது. உடனே {amount} அனுப்புங்கள், அவசரம்.", "whatsapp", "easy")],
    },
    "phishing": {
        "en": [
            ("OCBC: unusual login detected. Verify now at https://{domain}/login or your account will be suspended within 2 hours.", "sms", "easy"),
            ("Your bank card is blocked. Reply with your OTP and PIN to unlock it immediately.", "sms", "easy"),
            ("SingPost: your parcel could not be delivered. Pay a {small} redelivery fee at https://{domain} within 24 hours.", "sms", "easy"),
            ("Singapore Post: package held due to incomplete address. Update details and pay {small} at {domain} today.", "sms", "easy"),
            ("Singpass: your account will be deactivated. Log in at {domain} and enter your Singpass password to keep access.", "email", "easy"),
            ("Security team: we need the 6-digit code we just sent you to cancel a {amount} transaction. Please share it quickly.", "call", "easy"),
            ("IRAS: you have an unpaid tax refund of {amount}. Claim now at http://{domain} with your card number and CVV.", "email", "easy"),
            ("Dear customer, suspicious activity on your account. Confirm your login details at {domain} to avoid closure.", "email", "hard"),
        ],
        "zh": [("银行通知：您的账户被冻结，请回复验证码OTP解锁。", "sms", "easy"),
               ("您的包裹无法派送，请在24小时内到 {domain} 支付{small}运费。", "sms", "easy")],
        "ms": [("Bank: akaun anda disekat. Hantar kod OTP anda untuk buka semula.", "sms", "easy"),
               ("Bungkusan anda tertahan. Bayar {small} di {domain} dalam 24 jam.", "sms", "easy")],
        "ta": [("உங்கள் வங்கி கணக்கு முடக்கப்பட்டது. {domain} இல் உங்கள் OTP ஐ உள்ளிடுங்கள்.", "sms", "easy")],
    },
    "ecommerce": {
        "en": [
            ("Selling 2x {artist} concert tickets, below price! PayNow first, no meetup, I'll send e-tickets after.", "social", "easy"),
            ("Last 2 {artist} tickets cat 1, {amount} only. Must PayNow deposit now, many people asking. No meetup sorry.", "telegram", "easy"),
            ("Carousell: item reserved for you. Pay via this link {domain} to confirm. Seller can't meet, will courier.", "whatsapp", "easy"),
            ("Cheap {item} {amount}, brand new. Transfer first, delivery tomorrow. No COD.", "social", "easy"),
            ("Pokemon card pre-order! Booster box {amount}, PayNow first to secure your slot, no meetup, will mail when stock arrives.", "telegram", "easy"),
            ("Room for rent near MRT, {amount}/month. Pay deposit first to reserve, cannot meet for viewing as I'm overseas.", "social", "hard"),
            ("Buyer here, I paid via Carousell protection. Click {domain} to receive your payment and enter your bank login.", "whatsapp", "hard"),
        ],
        "zh": [("演唱会门票特价，先PayNow付款，不见面交易。", "social", "easy"),
               ("{item}超便宜，限量，先付款再寄出，不见面。", "social", "easy")],
        "ms": [("Tiket konsert murah! PayNow dahulu, tiada jumpa.", "social", "easy")],
        "ta": [],
    },
    "job": {
        "en": [
            ("Part-time job: earn $300 per day just liking videos. No experience needed. Pay a registration deposit to start. Contact us on Telegram.", "sms", "easy"),
            ("HR Onboarding at {company}: congratulations, you're hired! Please pay an upfront training fee of {amount} before your first day.", "whatsapp", "easy"),
            ("Work from home, earn $500 per day! Complete simple tasks. First top up {amount} to unlock commission. WhatsApp us now.", "sms", "easy"),
            ("Hi, I'm a recruiter. Easy online job, $200-$800 daily. Move to Telegram for details. Deposit required to activate your account.", "whatsapp", "easy"),
            ("Earn $1000 per week rating hotels. Start now, small deposit to verify you're real. Add me on Telegram.", "telegram", "easy"),
            ("{company} is hiring part-time reviewers, $80 per hour, no interview. Send your Singpass login to register.", "sms", "hard"),
        ],
        "zh": [("兼职工作：每天赚$300，只需点赞。先付押金开始，加我Telegram。", "sms", "easy"),
               ("在家工作日赚$500，先充值{amount}解锁佣金。", "whatsapp", "easy")],
        "ms": [("Kerja sambilan, dapat $300 sehari! Bayar deposit dahulu. Hubungi kami di Telegram.", "sms", "easy")],
        "ta": [("பகுதி நேர வேலை: ஒரு நாளைக்கு $300 சம்பாதிக்கலாம். முதலில் {small} டெபாசிட் செலுத்துங்கள். Telegram இல் தொடர்பு கொள்ளுங்கள்.", "sms", "easy")],
    },
    "investment": {
        "en": [
            ("Guaranteed {pct} monthly returns on crypto! Invest {amount} today, limited slots. Join our Telegram group.", "telegram", "easy"),
            ("Buy gold bars with us, 50% profit in 2 weeks. Transfer {amount} now before the price goes up.", "whatsapp", "easy"),
            ("My uncle works in a bank, insider stock tip. Put {amount} into this platform, guaranteed profit, keep it secret.", "whatsapp", "easy"),
            ("Welcome to the VIP investment group! Download our trading app from {domain} and deposit {amount} to start. Risk-free.", "social", "easy"),
            ("Our AI trading bot doubles your money in 30 days. USDT only. Deposit now, slots closing tonight.", "telegram", "easy"),
        ],
        "zh": [("保证每月{pct}回报！马上投资{amount}，名额有限。", "whatsapp", "easy"),
               ("内幕消息，稳赚不赔，加入我们的投资群，先转账{amount}。", "social", "easy")],
        "ms": [("Pelaburan terjamin untung {pct} sebulan! Pindahkan {amount} segera.", "whatsapp", "easy")],
        "ta": [],
    },
    "loan": {
        "en": [
            ("Instant loan approved up to {amount}! No credit check. Pay {small}0 admin fee first to release the money. WhatsApp {num}.", "sms", "easy"),
            ("Need cash fast? Guaranteed loan approval today. Transfer the insurance fee of {amount} and we disburse in 1 hour.", "sms", "easy"),
            ("Licensed moneylender: your loan of {amount} is ready. Pay a processing fee to release it. Reply YES now.", "whatsapp", "easy"),
            ("Easy loan, low interest, no documents. Send your Singpass and bank login to apply.", "social", "hard"),
        ],
        "zh": [("贷款秒批，无抵押！先付手续费{small}0即可放款。", "sms", "easy")],
        "ms": [("Pinjaman segera diluluskan! Bayar yuran pemprosesan dahulu untuk terima wang.", "sms", "easy")],
        "ta": [],
    },
    "romance": {
        "en": [
            ("My dear, I'm stuck at the airport customs. Please send {amount} so I can come and see you. I love you.", "social", "easy"),
            ("Honey, my investment account is locked. Can you transfer {amount}? I will pay back double next week.", "whatsapp", "easy"),
            ("Sweetheart, I sent you a gift parcel but customs needs a {amount} fee. Please pay it so you can receive it.", "social", "easy"),
            ("Darling, my daughter is in hospital overseas and I can't access my bank. Help me with {amount}, I'll repay when I visit.", "whatsapp", "hard"),
        ],
        "zh": [("亲爱的，我在机场海关被扣留了，请帮我转{amount}，我爱你。", "social", "easy")],
        "ms": [("Sayang, saya tersekat di kastam. Tolong hantar {amount} supaya saya boleh jumpa awak.", "social", "easy")],
        "ta": [],
    },
    "business_email": {
        "en": [
            ("Hi, please note our bank details have changed. Kindly pay invoice INV-2291 of {amount} to the new account number below. Urgent.", "email", "easy"),
            ("This is the director. I need you to make an urgent payment of {amount} to a new supplier today. Keep this confidential.", "email", "easy"),
            ("Accounts team: due to an audit, please update our payment details and transfer the outstanding {amount} to our new bank account.", "email", "easy"),
            ("CEO here, in a meeting. Buy {amount} of gift cards for a client and send me the codes. Don't tell finance.", "whatsapp", "hard"),
        ],
        "zh": [("您好，我司银行账户已更改，请将发票款项{amount}转入新的账户，紧急。", "email", "easy")],
        "ms": [],
        "ta": [],
    },
    "prize": {
        "en": [
            ("Congratulations! You won {amount} in our lucky draw. Pay a {small}0 processing fee at {domain} to claim.", "sms", "easy"),
            ("You have been selected for a government cash payout. Verify your bank login at {domain}.", "sms", "easy"),
            ("You won a {game} giveaway! Pay {small} shipping and give us your login to receive the prize.", "social", "easy"),
            ("Free {game} diamonds! Log in with your account at {domain} to claim 10,000 gems now, limited time.", "social", "easy"),
        ],
        "zh": [("恭喜您中奖{amount}！请到{domain}支付手续费领取。", "sms", "easy")],
        "ms": [("Tahniah! Anda menang hadiah {amount}. Bayar yuran di {domain} untuk tuntut.", "sms", "easy")],
        "ta": [],
    },
    "tech_support": {
        "en": [
            ("Microsoft support: your computer has a virus. Install AnyDesk so our technician can fix it and refund {amount}.", "call", "easy"),
            ("Bank IT team here. Download the security app from {domain} and approve the transaction for me so we can protect your account.", "call", "easy"),
            ("Your phone is hacked. Install the app at {domain} (not on Play Store) to remove the virus now.", "sms", "easy"),
            ("Telco notice: your line will be cut today. Install our remote access tool and share your screen to verify.", "call", "easy"),
        ],
        "zh": [("您的电脑中毒了，请安装远程软件让我们帮您修复，并退款{amount}。", "call", "easy")],
        "ms": [],
        "ta": [],
    },
}

# Legitimate messages. "hard" = they share words with scams (OTP, parcel, borrow, job, limited time).
LEGIT = {
    "en": [
        # hard negatives
        ("OCBC: Your OTP is 482913 for a payment of {amount}. Never share your OTP with anyone, including OCBC staff.", "sms", "hard"),
        ("OCBC will never ask you to transfer money to a 'safe account' or share your PIN. If in doubt, call us in the app.", "sms", "hard"),
        ("OCBC: Your monthly statement for {month} is ready. View it in the OCBC app. We will never ask for your OTP or password.", "sms", "hard"),
        ("OCBC: A payment of {amount} to SP Group was made on {day}. If this wasn't you, call the number on the back of your card.", "sms", "hard"),
        ("Reminder from OCBC: update your app to the latest version from the official app store. Do not install apps from links.", "sms", "hard"),
        ("SingPost: your parcel will be delivered on {day} between 9am and 6pm. No action needed.", "sms", "hard"),
        ("SingPost: we missed you today. Your item is at the post office for collection until {day}. Bring your ID.", "sms", "hard"),
        ("Your Shopee parcel has been delivered to your doorstep. Thanks for shopping!", "sms", "hard"),
        ("Hey, can I borrow {amount} till payday? No rush at all, can talk when you're free.", "whatsapp", "hard"),
        ("Dad, can you transfer {amount} for my school trip? Teacher said pay by {day}. I'll show you the letter tonight.", "whatsapp", "hard"),
        ("Interview confirmed: {day} 10am at {company}, 12 Marina Boulevard. Please bring your resume. No fees required.", "email", "hard"),
        ("Hi {name}, thanks for applying to {company}. We'll email you about the next interview round within 2 weeks.", "email", "hard"),
        ("{company} part-time job: weekend retail assistant, $12 per hour. Apply on our careers page, interviews in person.", "social", "hard"),
        ("Concert tickets are now on sale on the official ticketing website. Limit 4 per customer.", "social", "hard"),
        ("Limited time offer: 20% off all shoes this weekend in store and on our app. While stocks last.", "sms", "hard"),
        ("Your {game} account login from a new device. If this was you, no action needed.", "email", "hard"),
        ("Your CPF statement is available. Log in to the CPF website with Singpass to view it.", "sms", "hard"),
        ("IRAS: your tax bill is ready. View it on myTax Portal. We will never ask for payment by phone.", "sms", "hard"),
        ("Police advisory: scammers may pose as officers. The police will never ask you to transfer money. Call 1799 if unsure.", "social", "hard"),
        ("Carousell: buyer {name} sent you an offer. Meet up at the MRT station to deal in person.", "social", "hard"),
        ("Pokemon cards for sale, meet at Bishan MRT on {day}, you can check the cards first then pay cash or PayNow.", "social", "hard"),
        ("Our shop's Pokémon pre-orders open on the official website. Pay at the counter when you collect in store.", "social", "hard"),
        ("Selling my old textbook, $15, can meet at Tampines MRT on {day}. Cash or PayNow on the spot.", "social", "hard"),
        ("Your transfer of {amount} to Tan Wei Ming was successful.", "sms", "hard"),
        ("Your monthly salary of {amount} has been credited to your account.", "sms", "hard"),
        ("Hi team, finance here. Supplier invoices for {month} are due Friday, please submit through the usual portal.", "email", "hard"),
        ("Urgent: the lift in Block 21 is down today. Town Council technicians are on the way.", "sms", "hard"),
        ("NUH: your appointment reminder for {day} 2pm, Clinic B. To reschedule, call the number on your appointment card.", "sms", "hard"),
        ("Congratulations on your graduation! So proud of you, see you at dinner on {day}.", "whatsapp", "hard"),
        ("Grab: your verification code is 5521. Do not share this code with anyone.", "sms", "hard"),
        # easy negatives (ordinary messages)
        ("Reminder: your Town Council S&CC charges are due on the 15th. Pay through your usual bank app.", "sms", "easy"),
        ("SP Group: your utilities bill for {month} is {amount}. Pay through AXS, GIRO or your bank app.", "email", "easy"),
        ("Hi Mum, I'll be home late tonight, don't wait for dinner. Love you.", "whatsapp", "easy"),
        ("Hey, are we still meeting at the hawker centre at 7 on {day}?", "whatsapp", "easy"),
        ("Your appointment at the polyclinic is on {day} at 10:30am. Please bring your NRIC. Reply Y to confirm.", "sms", "easy"),
        ("Your GrabFood order is on the way! Track it in the Grab app.", "sms", "easy"),
        ("Team, the project meeting is moved to {day} 3pm in room 4. Please bring your laptops.", "email", "easy"),
        ("Lecturer: assignment 2 deadline extended to {day} 11:59pm. Submit on the school portal.", "email", "easy"),
        ("Happy birthday Grandma! See you on {day} for lunch.", "whatsapp", "easy"),
        ("Dad, can you pick me up from school at 5? Thanks.", "whatsapp", "easy"),
        ("Library: your books are due on {day}. Renew online or at any branch.", "sms", "easy"),
        ("Gym class tomorrow at 7am cancelled due to maintenance. Sorry for the inconvenience.", "sms", "easy"),
        ("Aunty, the church gathering is on {day} 6pm. Bring a dish if you can.", "whatsapp", "easy"),
        ("Hey can you send me the notes from today's lecture? Thanks!", "whatsapp", "easy"),
        ("Your Singtel bill of {amount} for {month} is ready. View it in the My Singtel app.", "sms", "easy"),
        ("Movie night at my place {day}? I'll get the snacks.", "whatsapp", "easy"),
        ("Thanks for your donation of {amount} to the community food bank. Receipt attached.", "email", "easy"),
        ("The plumber will come on {day} morning to fix the kitchen sink.", "whatsapp", "easy"),
        ("Can I borrow your umbrella tomorrow? I'll return it after class.", "whatsapp", "easy"),
        ("Wah the queue at the kopitiam damn long today, I tapau for you can?", "whatsapp", "easy"),
    ],
    "zh": [
        ("OCBC：您的验证码是 731942。切勿与任何人分享验证码，包括银行职员。", "sms", "hard"),
        ("OCBC：您的{month}月结单已经可以在应用程序中查看。我们绝不会向您索取验证码。", "sms", "hard"),
        ("您的包裹将于{day}送达，无需任何操作。", "sms", "hard"),
        ("警方提醒：警察绝不会要求您转账。如有疑问请拨打1799。", "social", "hard"),
        ("我这个月手头紧，可以先借我{amount}吗？不急，下个月还你，有空打给我。", "whatsapp", "hard"),
        ("妈，我今晚晚点回家，不用等我吃饭。", "whatsapp", "easy"),
        ("您的诊所预约在{day}上午10点，请带身份证。", "sms", "easy"),
        ("星期天一起去喝茶吗？我来接你。", "whatsapp", "easy"),
        ("您的水电费账单已出，请通过银行应用程序付款。", "sms", "easy"),
        ("孙子考试通过了，谢谢大家的关心！", "whatsapp", "easy"),
        ("面试安排在{day}上午10点，请带上简历，不收任何费用。", "email", "hard"),
    ],
    "ms": [
        ("OCBC: Kod OTP anda ialah 551203. Jangan kongsi kod ini dengan sesiapa, termasuk kakitangan bank.", "sms", "hard"),
        ("OCBC: penyata bulanan anda sudah tersedia dalam aplikasi. Kami tidak akan meminta OTP anda.", "sms", "hard"),
        ("Bungkusan anda akan dihantar pada hari {day}. Tiada tindakan diperlukan.", "sms", "hard"),
        ("Boleh pinjam {amount} sampai gaji masuk? Tak payah tergesa-gesa, nanti kita bincang.", "whatsapp", "hard"),
        ("Mak, saya balik lambat malam ini. Jangan tunggu makan malam.", "whatsapp", "easy"),
        ("Temujanji klinik anda pada {day} jam 10 pagi. Sila bawa kad pengenalan.", "sms", "easy"),
        ("Jumpa di masjid hari Jumaat nanti, insya-Allah.", "whatsapp", "easy"),
        ("Bil SP Group anda untuk bulan {month} ialah {amount}. Bayar melalui aplikasi bank anda.", "sms", "easy"),
        ("Kelas tuisyen esok dibatalkan. Jumpa minggu depan.", "whatsapp", "easy"),
    ],
    "ta": [
        ("OCBC: உங்கள் OTP 662410. இந்த குறியீட்டை யாரிடமும் பகிர வேண்டாம்.", "sms", "hard"),
        ("அம்மா, இன்று இரவு தாமதமாக வருவேன். சாப்பாட்டுக்கு காத்திருக்க வேண்டாம்.", "whatsapp", "easy"),
        ("உங்கள் மருத்துவ சந்திப்பு {day} காலை 10 மணிக்கு. அடையாள அட்டையை கொண்டு வாருங்கள்.", "sms", "easy"),
        ("இந்த வாரம் கோவிலில் சந்திப்போம்.", "whatsapp", "easy"),
        ("உங்கள் பார்சல் {day} அன்று வழங்கப்படும். எந்த நடவடிக்கையும் தேவையில்லை.", "sms", "hard"),
    ],
    # code-mixed Singlish / Chinese / Malay
    "mixed": [
        ("Eh bro tonight makan where? 我请客 lah.", "whatsapp", "easy"),
        ("Ma, I reach already, nanti call you ok.", "whatsapp", "easy"),
        ("Can pass me the 课本 tomorrow? Thanks ah.", "whatsapp", "easy"),
    ],
}
SCAM_MIXED = [
    ("Ah girl, 我换了新号码 lah. Urgent need {amount}, PayNow first can? Don't tell papa.", "fake_friend", "whatsapp", "hard"),
    ("Bro, part-time kerja senang, earn $300 per day, deposit dulu then can start. Add Telegram.", "job", "telegram", "hard"),
    ("MAS officer 说你的户口 got problem, must transfer to safe account now, don't tell anyone.", "government_official", "call", "hard"),
]
SHORT = ["ok", "Ok noted", "can", "on the way", "thanks!", "see you", "yes", "lol", "haha ok", "k", "noted with thanks", "otw", "👍 ok", "sure"]
PREFIX = ["", "", "", "Dear customer, ", "Hi, ", "Hello, "]
SUFFIX = ["", "", "", " Thanks.", " Thank you.", " Pls reply asap."]


def fill(t: str) -> str:
    return t.format(**{k: rng.choice(v) for k, v in SLOTS.items()})


def surface(s: str, label: str, difficulty: str) -> tuple[str, str]:
    if rng.random() < 0.2:
        s = s.lower()
    if label == "scam" and difficulty == "easy" and rng.random() < 0.08:
        # adversarial: spaced-out keyword or zero-width character, both seen in real scam SMS
        s = s.replace("safe account", "s a f e  a c c o u n t").replace("OTP", "O​T​P").replace("deposit", "d3posit")
        difficulty = "adversarial"
    if rng.random() < 0.25:
        s = rng.choice(PREFIX) + s + rng.choice(SUFFIX)
    return s, difficulty


def expand(rows, seen, template, label, scam_type, lang, channel, difficulty, family, n):
    made, tries = 0, 0
    while made < n and tries < n * 12:
        tries += 1
        s, diff = surface(fill(template), label, difficulty)
        if s not in seen:
            seen.add(s)
            rows.append([s, label, scam_type, lang, channel, diff, family])
            made += 1


def main():
    rows: list[list[str]] = []
    seen: set[str] = set()
    per_lang = {"en": 7, "zh": 9, "ms": 9, "ta": 8, "mixed": 6}
    for st, langs in SCAM.items():
        for lang, templates in langs.items():
            for i, (t, ch, diff) in enumerate(templates):
                expand(rows, seen, t, "scam", st, lang, ch, diff, f"scam-{st}-{lang}-{i:02d}",
                       per_lang[lang] + (2 if st in {"business_email", "tech_support"} else 0))
    for i, (t, st, ch, diff) in enumerate(SCAM_MIXED):
        expand(rows, seen, t, "scam", st, "mixed", ch, diff, f"scam-mixed-{i:02d}", per_lang["mixed"])
    for lang, templates in LEGIT.items():
        for i, (t, ch, diff) in enumerate(templates):
            n = per_lang[lang] + (4 if diff == "hard" else 2)
            expand(rows, seen, t, "legit", "", lang, ch, diff, f"legit-{lang}-{i:02d}", n)
    for i, s in enumerate(SHORT):
        for v in {s, s.capitalize(), s + "."}:
            if v not in seen:
                seen.add(v)
                rows.append([v, "legit", "", "en", "whatsapp", "hard", f"legit-short-{i:02d}"])
    rng.shuffle(rows)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["text", "label", "scam_type", "language", "channel", "difficulty", "template_family"])
        w.writerows(rows)
    scam = sum(r[1] == "scam" for r in rows)
    print(f"wrote {len(rows)} rows to {OUT} (scam={scam}, legit={len(rows) - scam}, "
          f"hard negatives={sum(r[1] == 'legit' and r[5] == 'hard' for r in rows)})")


if __name__ == "__main__":
    main()
