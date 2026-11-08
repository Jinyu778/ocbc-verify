"""Generates backend/data/messages.csv: labelled SYNTHETIC scam and legitimate messages.

Run:  python data/generate_messages.py
Deterministic (fixed seed). Every name, number and link is made up.
"""

import csv
import random
from pathlib import Path

rng = random.Random(42)
OUT = Path(__file__).with_name("messages.csv")

names = ["Mr Lim", "Ms Tan", "Officer Wong", "Inspector Lee", "Mr Ng", "Ms Chua", "Mr Goh", "Ms Teo", "Aunty Mary", "Uncle Ben"]
amounts = ["$500", "$1,200", "$3,000", "$8,000", "$15,000", "$250", "$80", "$2,500", "$6,800"]
small = ["$1.99", "$2.50", "$3.20", "$1.50", "$4.80"]
domains = ["sg-parcel-track.info", "mas-verify.top", "safebank-secure-login.xyz", "singpost-redeliver.cc",
           "ica-check.online", "dbs-refund.click", "concert-tix-sg.shop", "job-hub-sg.work", "lazada-promo.win"]
days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
artists = ["Taylor", "Coldplay", "Jay Chou", "BLACKPINK", "Ed Sheeran", "Mayday"]
games = ["Genshin", "Mobile Legends", "Valorant", "Roblox", "PUBG"]

scam_templates = [
    # government / MAS / police impersonation (seniors)
    "This is {name} from the Monetary Authority of Singapore. Your bank account is linked to money laundering. Transfer your savings to the MAS safety account immediately.",
    "URGENT: {name} from Singapore Police Force. A warrant has been issued in your name. Do not tell anyone. Move {amount} to a safe account to clear your name.",
    "Ministry of Health notice: your NRIC was used in a criminal case. Call back now and keep this confidential. Failure to comply will lead to arrest.",
    "MAS officer here. For your protection, move all funds to a government safety account today. Do not inform your family or the bank.",
    "Court notice: you have a pending case. Pay {amount} within 24 hours or a warrant of arrest will be issued. Reply now.",
    "ICA alert: your passport is suspended. Verify your identity at {domain} and provide your OTP to avoid legal action.",
    "Inspector {name}: your account will be frozen today. Transfer funds to the safe account I give you. This call is secret, do not hang up.",
    "Official: you are under investigation. Install the app from {domain} so we can check your phone. Do not tell the bank staff.",
    # bank impersonation / OTP phishing
    "SafeBank: unusual login detected. Verify now at https://{domain}/login or your account will be suspended within 2 hours.",
    "Your bank card is blocked. Reply with your OTP and PIN to unlock it immediately.",
    "Dear customer, confirm your password at http://{domain} to avoid account closure today.",
    "Security team: we need the 6-digit code we just sent you to cancel a {amount} transaction. Please share it quickly.",
    "Your account has been compromised. Move your money to a new protected account now. Our officer will guide you.",
    # parcel fee
    "SingPost: your parcel could not be delivered. Pay a {small} redelivery fee at https://{domain} within 24 hours.",
    "Your package is held at customs. Pay {small} now at {domain} or it will be returned.",
    "Delivery failed: incomplete address. Update details and pay {small} at http://{domain} today.",
    # hijacked friend / family / new number
    "Hi Mum, this is my new number. My phone broke. Can you transfer {amount} to my friend's account? Urgent, I'll explain later.",
    "Hey it's me, lost my phone. Using this new number. Need {amount} urgently for hospital bill, please PayNow now, don't call.",
    "Ah girl, I'm in trouble overseas. Please send {amount} to this account, don't tell Dad. Very urgent.",
    "Bro can lend me {amount}? My bank app got problem, will return tomorrow. PayNow to this number pls, don't tell anyone.",
    "Grandma, I got arrested and need {amount} bail money now. Please keep it secret from my parents.",
    # fake jobs (young people)
    "Part-time job: earn $300 per day just liking videos. No experience needed. Pay a {small}0 registration deposit to start. Contact us on Telegram.",
    "HR Onboarding: congratulations, you're hired! Please pay an upfront training fee of {amount} before your first day.",
    "Work from home, earn $500 per day! Complete simple tasks. First top up {amount} to unlock commission. WhatsApp us now.",
    "Hi, I'm a recruiter. Easy online job, $200-$800 daily. Move to Telegram for details. Deposit required to activate your account.",
    "Job offer: data entry, $150/hour. Pay {amount} for your work laptop, refundable after first salary.",
    "Earn $1000 per week rating hotels. Start now, small deposit to verify you're real. Add me on Telegram.",
    # tickets / online shopping / gaming
    "Selling 2x {artist} concert tickets, below price! PayNow first, no meetup, I'll send e-tickets after.",
    "Last 2 {artist} tickets cat 1, {amount} only. Must PayNow deposit now, many people asking. No meetup sorry.",
    "Carousell: item reserved for you. Pay via this link {domain} to confirm. Seller can't meet, will courier.",
    "Cheap iPhone 16 Pro {amount}, brand new. Transfer first, delivery tomorrow. No COD.",
    "Free {game} diamonds! Log in with your account at {domain} to claim 10,000 gems now, limited time.",
    "{game} top-up 90% off! Pay by gift card. Send me the gift card code to receive your credits.",
    "You won a {game} giveaway! Pay {small} shipping and give us your login to receive the prize.",
    # investment / crypto / gold
    "Guaranteed 30% monthly returns on crypto! Invest {amount} today, limited slots. Join our Telegram group.",
    "Buy gold bars with us, 50% profit in 2 weeks. Transfer {amount} now before the price goes up.",
    "My uncle works in a bank, insider stock tip. Put {amount} into this platform, guaranteed profit, keep it secret.",
    "Pay with Bitcoin to secure your investment slot. Our advisor will guide you on WhatsApp.",
    "Buy Apple gift cards worth {amount} and send me photos of the codes. It's for the office, urgent.",
    # romance
    "My dear, I'm stuck at the airport customs. Please send {amount} so I can come and see you. I love you.",
    "Honey, my investment account is locked. Can you transfer {amount}? I will pay back double next week.",
    # lucky draw
    "Congratulations! You won {amount} in our lucky draw. Pay a {small}0 processing fee at {domain} to claim.",
    "You have been selected for a government cash payout. Verify your bank login at {domain}.",
]

scam_zh = [
    "您好，我是新加坡金融管理局的官员。您的账户涉及洗钱，请马上把钱转到安全账户，不要告诉家人。",
    "警察局通知：您涉及刑事案件，已发出逮捕令。请保密并立即转账{amount}。",
    "妈，我换了新号码，手机坏了。急需{amount}，请马上转账给我朋友，不要打电话。",
    "兼职工作：每天赚$300，只需点赞。先付押金{small}0开始，加我Telegram。",
    "您的包裹无法派送，请在24小时内到 {domain} 支付{small}运费。",
    "银行通知：您的账户被冻结，请回复验证码OTP解锁。",
    "保证每月30%回报！马上投资{amount}，名额有限。",
    "演唱会门票特价，先PayNow付款，不见面交易。",
]
scam_ms = [
    "Ini pegawai MAS. Akaun anda terlibat dengan pengubahan wang haram. Pindahkan wang ke akaun selamat sekarang. Jangan beritahu sesiapa.",
    "Polis: waran tangkap telah dikeluarkan. Bayar {amount} segera dan rahsiakan perkara ini.",
    "Mak, ini nombor baru saya. Telefon rosak. Tolong pindahkan {amount} segera, jangan telefon.",
    "Kerja sambilan, dapat $300 sehari! Bayar deposit {small}0 dahulu. Hubungi kami di Telegram.",
    "Bungkusan anda tertahan. Bayar {small} di {domain} dalam 24 jam.",
    "Bank: akaun anda disekat. Hantar kod OTP anda untuk buka semula.",
    "Tiket konsert murah! PayNow dahulu, tiada jumpa.",
]

legit_templates = [
    "SafeBank: Your monthly statement for {month} is ready. View it in the SafeBank app. We will never ask for your OTP or password.",
    "SafeBank: A payment of {amount} to SP Group was made on {day}. If this wasn't you, call us using the number on your card.",
    "Reminder: your Town Council S&CC charges are due on the 15th. Pay through your usual bank app.",
    "SP Group: your utilities bill for {month} is {amount}. Pay through AXS, GIRO or your bank app.",
    "Hi Mum, I'll be home late tonight, don't wait for dinner. Love you.",
    "Hey, are we still meeting at the hawker centre at 7 on {day}?",
    "Your appointment at the polyclinic is on {day} at 10:30am. Please bring your NRIC. Reply Y to confirm.",
    "NUH: your appointment reminder for {day} 2pm, Clinic B. To reschedule, call the number on your appointment card.",
    "Your GrabFood order is on the way! Track it in the Grab app.",
    "Carousell: buyer {name} sent you an offer. Meet up at the MRT station to deal in person.",
    "Selling my old textbook, $15, can meet at Tampines MRT on {day}. Cash or PayNow on the spot.",
    "Team, the project meeting is moved to {day} 3pm in room 4. Please bring your laptops.",
    "Lecturer: assignment 2 deadline extended to {day} 11:59pm. Submit on the school portal.",
    "Your Shopee parcel has been delivered to your doorstep. Thanks for shopping!",
    "SingPost: your parcel will be delivered on {day} between 9am and 6pm. No action needed.",
    "Happy birthday Grandma! See you on {day} for lunch.",
    "Dad, can you pick me up from school at 5? Thanks.",
    "Your CPF statement is available. Log in to the CPF website with Singpass to view it.",
    "Interview confirmed: {day} 10am at our office, 12 Marina Boulevard. Please bring your resume. No fees required.",
    "Hi {name}, thanks for applying. We'll email you about the next interview round within 2 weeks.",
    "Concert tickets are now on sale on the official ticketing website. Limit 4 per customer.",
    "Your {game} account login from a new device. If this was you, no action needed.",
    "Library: your books are due on {day}. Renew online or at any branch.",
    "Gym class tomorrow at 7am cancelled due to maintenance. Sorry for the inconvenience.",
    "Aunty, the church gathering is on {day} 6pm. Bring a dish if you can!",
    "SafeBank will never ask you to transfer money to a 'safe account'. If in doubt, call us in the app.",
    "Your monthly salary of {amount} has been credited to your account.",
    "Hey can you send me the notes from today's lecture? Thanks!",
    "Mum, I reached school already. Will call you later.",
    "Your Singtel bill of {amount} for {month} is ready. View it in the My Singtel app.",
    "Hi, your dental cleaning is scheduled for {day} at 9am. Reply C to confirm or R to reschedule.",
    "Movie night at my place {day}? I'll get the snacks.",
    "Reminder from SafeBank: update your app to the latest version from the official app store.",
    "Your transfer of {amount} to Tan Wei Ming was successful.",
    "Thanks for your donation of {amount} to the community food bank. Receipt attached.",
    "Grandpa, I passed my exams! Thanks for all your support.",
    "The plumber will come on {day} morning to fix the kitchen sink.",
    "Can I borrow your umbrella tomorrow? I'll return it after class.",
]
legit_zh = [
    "妈，我今晚晚点回家，不用等我吃饭。",
    "您的诊所预约在{day}上午10点，请带身份证。",
    "SafeBank：您的{month}月结单已经可以在应用程序中查看。我们绝不会向您索取验证码。",
    "星期天一起去喝茶吗？我来接你。",
    "您的水电费账单已出，请通过银行应用程序付款。",
    "孙子考试通过了，谢谢大家的关心！",
]
legit_ms = [
    "Mak, saya balik lambat malam ini. Jangan tunggu makan malam.",
    "Temujanji klinik anda pada {day} jam 10 pagi. Sila bawa kad pengenalan.",
    "SafeBank: penyata bulanan anda sudah tersedia dalam aplikasi.",
    "Jumpa di masjid hari Jumaat nanti, insya-Allah.",
    "Bil SP Group anda untuk bulan {month} ialah {amount}. Bayar melalui aplikasi bank anda.",
    "Kelas tuisyen esok dibatalkan. Jumpa minggu depan.",
]
months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October"]


def fill(t: str) -> str:
    return t.format(name=rng.choice(names), amount=rng.choice(amounts), small=rng.choice(small),
                    domain=rng.choice(domains), day=rng.choice(days), artist=rng.choice(artists),
                    game=rng.choice(games), month=rng.choice(months))


def variants(templates, n_each, label, lang):
    rows = {}
    for i, t in enumerate(templates):
        tries = 0
        made = 0
        while made < n_each and tries < n_each * 6:
            tries += 1
            s = fill(t)
            if rng.random() < 0.25:
                s = s.lower()
            if rng.random() < 0.15:
                s = s.replace(".", "!!", 1)
            if s not in rows:
                rows[s] = f"{label}-{lang}-{i:02d}"
                made += 1
    return [(s, label, lang, tid) for s, tid in rows.items()]


def main():
    data = []
    data += variants(scam_templates, 5, "scam", "en")
    data += variants(scam_zh, 3, "scam", "zh")
    data += variants(scam_ms, 3, "scam", "ms")
    data += variants(legit_templates, 5, "legit", "en")
    data += variants(legit_zh, 3, "legit", "zh")
    data += variants(legit_ms, 3, "legit", "ms")
    rng.shuffle(data)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["text", "label", "lang", "template_id"])
        w.writerows(data)
    print(f"wrote {len(data)} rows to {OUT} "
          f"(scam={sum(1 for r in data if r[1] == 'scam')}, legit={sum(1 for r in data if r[1] == 'legit')})")


if __name__ == "__main__":
    main()
