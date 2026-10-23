#!/usr/bin/env python3
"""Builds foods.js for the Weight page.

Sources
  1. Curated list (below): common Indian home / restaurant / KFC portions, hand-checked.
  2. Indian Nutrient Databank (INDB, 2024, ~1,000 Indian recipes)
     https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-   (INDB.xlsx)
  3. Indian Food Composition Tables 2017 (NIN), raw foods, via https://github.com/nodef/ifct2017
     (compositions/index.csv)

Usage: python3 tools/build-foods.py <INDB.xlsx> <ifct compositions/index.csv>   (curated base rows: tools/foods-curated.json)
Everything is stored per 100 g plus a list of portions [label, grams], so any food can be
logged by katori, plate, piece or exact grams.
"""
import sys, re, json
import pandas as pd

INDB, IFCT = sys.argv[1], sys.argv[2]

CATS = {"g":"Roti & rice","d":"Dal & veg","c":"Chicken & meat","f":"Fish & egg","a":"Assamese","b":"Breakfast",
        "x":"Chinese","k":"KFC & fast food","s":"Snacks","w":"Sweets","r":"Drinks","u":"Fruit & nuts",
        "z":"Soups & salads","e":"Baked & western","v":"Raw vegetables","q":"Raw meat & fish","y":"Raw grains & dal","o":"Extras"}

# ---------------------------------------------------------------- 1. curated
# id: grams in the base portion
G = dict(
 roti=40, **{"roti-ghee":45}, phulka=30, paratha=80, **{"aloo-paratha":120,"gobi-paratha":120,"paneer-paratha":120}, puri=25, luchi=22,
 naan=90, **{"butter-naan":100,"tandoori-roti":55}, kulcha=90, rice=150, **{"rice-plate":250,"brown-rice":150,"jeera-rice":150}, pulao=150,
 khichdi=150, **{"curd-rice":150,"chicken-biryani":300,"mutton-biryani":300,"egg-biryani":300,"veg-biryani":300}, bread=28, **{"brown-bread":28}, pav=45,
 papad=12, **{"papad-fried":13}, pickle=5, salad=150,
 **{"chicken-tikka":150,"tandoori-leg":150,"tandoori-half":300,"grilled-chicken":100,"chicken-pakora":100,"chicken-roll":200,"chicken-soup":250},
 **{"fish-curry":150,"fish-fry":80,"fish-fry-small":100,"egg-boiled":50,"egg-fried":50,"omelette":110,"bhurji":120,"egg-curry":200},
 **{"masor-tenga":200,"jolpan":250,"til-pitha":35,"ghila-pitha":40,"narikol-laru":25},
 poha=200, upma=200, idli=40, dosa=80, **{"masala-dosa":170}, uttapam=120, vada=45, chutney=30, oats=250, cornflakes=230,
 **{"bread-butter":66,"bread-omelette":166,"sandwich-veg":150},
 **{"veg-noodles":300,"chicken-noodles":300,"egg-noodles":300,"street-chowmein":300,"veg-fried-rice":300,"chicken-fried-rice":300,"egg-fried-rice":300,
    "schezwan-rice":300,"chilli-chicken":200,"chilli-chicken-g":250,"chicken-manchurian":250,"veg-manchurian":250,"chilli-paneer":200,
    "honey-chilli-potato":200,"momo-veg":180,"momo-chicken":180,"momo-fried":200,"spring-roll":120,"thukpa":400,"hot-sour-soup":250,
    "manchow-soup":250,"sweet-corn-soup":250},
 **{"kfc-hot-crispy":110,"kfc-original":100,"kfc-smoky":100,"kfc-wings":70,"kfc-strips":40,"kfc-popcorn":100,"kfc-popcorn-l":165,"kfc-zinger":200,
    "kfc-veg-zinger":190,"kfc-chicken-burger":140,"kfc-twister":200,"kfc-rice-bowl":350,"kfc-fries":110,"kfc-fries-l":150,"kfc-krusher":300,
    "mc-aloo-tikki":145,"mc-chicken":170,"pizza-veg":85,"pizza-chicken":90,"shawarma":250,"sandwich-chicken":160,"egg-roll":180,"maggi":70,"fries":110},
 samosa=90, kachori=60, pakora=80, **{"vada-pav":140,"pav-bhaji":350,"chole-bhature":400,"pani-puri":120}, bhel=150, chaat=150, dhokla=80, bhujia=30,
 chips=25, **{"biscuit-marie":14,"biscuit-parle":26,"biscuit-cream":26}, rusk=30, peanuts=30, **{"chana-roasted":30}, makhana=25, sprouts=100, cake=70,
 **{"gulab-jamun":50}, rasgulla=50, rasmalai=80, sandesh=30, jalebi=35, laddoo=40, barfi=35, kheer=150, **{"sooji-halwa":100,"gajar-halwa":150,"ice-cream":65}, chocolate=13,
 tea=150, **{"tea-nosugar":150,"tea-black":150}, coffee=150, milk=250, lassi=250, chaas=250, **{"cold-drink":300}, juice=200, sugarcane=250,
 **{"coconut-water":250,"protein-shake":280}, beer=650, whisky=30,
 banana=120, apple=180, orange=130, papaya=150, mango=200, guava=100, grapes=150, pineapple=150, watermelon=150, dates=16, almonds=12, cashews=15,
 paneer=100, ghee=5, butter=5, oil=5, cheese=20, **{"peanut-butter":16}, sugar=5, jaggery=10, honey=7, jam=20,
)
import os
cur = json.load(open(sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), "foods-curated.json")))

def r1(x): return round(float(x), 1)

def units_for(label, g, c):
    lab = label.lower()
    unit = "ml" if c == "r" else "g"
    if not re.search(r"\d+ ?(g|ml)\b", lab): label = f"{label} ({g} {unit})"
    u = [[label, g]]
    if "katori" in lab: u.append(["1 bowl (250 g)", 250])
    if c == "g" and "katori" in lab: u.append(["1 plate (250 g)", 250])
    if c == "g" and "plate" in lab and "rice" in lab: u.append(["1 katori (150 g)", 150])
    if c == "r" and not re.search(r"peg|bottle|scoop", lab):
        u += [["1 cup (150 ml)", 150], ["1 glass (250 ml)", 250]]
    u.append(["100 " + unit, 100])
    seen, out = set(), []
    for l, gg in u:
        if gg in seen: continue
        seen.add(gg); out.append([l, gg])
    return out

# more curated rows: [id, cat, name, portion, kcal, protein, search words, grams]
EXTRA = [
 # assamese
 ["masor-jol","a","Masor jol (light fish curry)","1 pc with gravy",160,17,"maas jol fish rohu rui",200],
 ["kukura-mangxo","a","Kukura mangxo (desi chicken curry)","1 katori",260,22,"kukura chicken curry country",150],
 ["paro-mangxo","a","Paro mangxo (pigeon curry)","1 katori",280,24,"pigeon paro",150],
 ["gahori-lai","a","Gahori mangxo with lai xaak","1 katori",360,20,"pork mustard greens",150],
 ["ou-tenga-dal","a","Ou tenga dal","1 katori",120,6,"elephant apple dal",150],
 ["boror-tenga","a","Boror tenga","1 katori",200,8,"bora tenga lentil fritters sour",150],
 ["bengena-pitika","a","Bengena pitika","1 katori",120,2,"brinjal mash begun",150],
 ["masor-pitika","a","Masor pitika (fish mash)","1 katori",180,16,"fish mash maas",120],
 ["lai-xaak","a","Lai xaak bhaji","1 katori",80,3,"mustard greens",150],
 ["posola","a","Posola (banana stem) curry","1 katori",110,2,"banana stem kol posola",150],
 ["muri-ghonto","a","Masor muri ghonto","1 katori",220,12,"fish head",150],
 ["til-chutney","a","Til chutney / til bhaji","1 tbsp",60,2,"sesame",10],
 ["kharoli","a","Kharoli","1 tsp",15,0,"mustard paste",5],
 ["akhoi","a","Akhoi (puffed rice)","1 katori",60,1,"muri puffed rice",15],
 ["komal-saul","a","Komal saul with doi & gur","1 bowl",300,6,"komol soft rice",250],
 ["bora-saul","a","Bora saul (sticky rice)","1 katori",230,4,"sticky rice",150],
 ["tekeli-pitha","a","Tekeli pitha","1",150,3,"pitha",60],
 ["narikol-pitha","a","Narikol pitha","1",130,2,"coconut pitha",40],
 ["tilor-laru","a","Tilor laru","1",100,2,"sesame ladoo",25],
 ["maas-koni-bora","a","Maas koni bora (fish egg fritter)","1",90,6,"fish egg roe",35],
 # restaurant indian
 ["chicken-65","c","Chicken 65","1 plate",450,32,"chicken sixty five",200],
 ["chicken-lollipop","c","Chicken lollipop","2 pcs",260,16,"lollypop",100],
 ["malai-tikka","c","Chicken malai tikka","6 pcs",330,30,"reshmi",160],
 ["chicken-seekh","c","Chicken seekh kebab","2 pcs",220,20,"kabab",100],
 ["mutton-seekh-r","c","Mutton seekh kebab","2 pcs",260,18,"kabab",100],
 ["galouti","c","Galouti kebab","2 pcs",250,14,"kabab",90],
 ["chicken-do-pyaza","c","Chicken do pyaza","1 katori",280,22,"dopiaza",150],
 ["chicken-chettinad","c","Chicken chettinad","1 katori",300,22,"",150],
 ["chicken-lababdar","c","Chicken lababdar","1 katori",380,22,"",150],
 ["chicken-liver","c","Chicken liver fry","1 katori",220,20,"kaleji",100],
 ["fish-tikka-r","f","Fish tikka","6 pcs",240,30,"machli",150],
 ["amritsari-fish","f","Amritsari fish fry","1 plate",400,30,"machli",200],
 ["paneer-tikka","d","Paneer tikka","6 pcs",320,18,"",180],
 ["malai-kofta","d","Malai kofta","1 katori",400,8,"",150],
 ["navratan-korma","d","Navratan korma","1 katori",300,6,"",150],
 ["kaju-curry","d","Kaju curry","1 katori",400,10,"cashew",150],
 ["mushroom-masala","d","Mushroom masala","1 katori",200,6,"",150],
 ["chana-dal","d","Chana dal","1 katori",190,10,"daal",150],
 ["urad-dal","d","Urad dal","1 katori",190,10,"daal maah",150],
 ["veg-thali","g","Veg thali","1 thali",900,25,"meal",600],
 ["nonveg-thali","g","Chicken / mutton thali","1 thali",1100,45,"meal non veg",650],
 ["fish-thali","g","Fish thali","1 thali",1000,40,"meal maas",650],
 # chinese
 ["dragon-chicken","x","Dragon chicken","1 plate",450,28,"",200],
 ["garlic-chicken","x","Garlic chicken, gravy","1 bowl",350,24,"",250],
 ["chicken-chopsuey","x","Chicken chopsuey","1 plate",500,22,"american",350],
 ["veg-chopsuey","x","Veg chopsuey","1 plate",400,8,"american",350],
 ["chilli-fish","x","Chilli fish","1 plate",380,26,"",200],
 ["chilli-prawn","x","Chilli prawn","1 plate",360,24,"",200],
 ["chilli-pork","x","Chilli pork","1 plate",480,24,"",200],
 ["pork-momos","x","Pork momos, steamed","6 pcs",350,16,"momo dumpling",180],
 ["pan-momos","x","Pan-fried chicken momos","6 pcs",380,16,"momo dumpling",200],
 ["fried-wonton","x","Fried wontons","6 pcs",300,10,"",120],
 ["wonton-soup","x","Chicken wonton soup","1 bowl",180,12,"",300],
 ["clear-soup","x","Clear chicken soup","1 bowl",90,9,"",250],
 ["schezwan-noodles","x","Schezwan chicken noodles","1 plate",520,22,"szechuan",300],
 ["chicken-hakka-egg","x","Mixed hakka noodles (egg+chicken)","1 plate",540,26,"chowmein",300],
 # fast food chains
 ["kfc-peri-strips","k","KFC Peri Peri strips","3 pcs",320,26,"kfc",120],
 ["kfc-boneless","k","KFC Boneless chicken","1 pc",180,14,"kfc",70],
 ["kfc-classic-zinger","k","KFC Classic Zinger","1",500,25,"kfc burger",210],
 ["kfc-popcorn-burger","k","KFC Popcorn burger","1",400,15,"kfc",160],
 ["kfc-bucket-8","k","KFC Bucket (8 pcs Hot & Crispy)","bucket",2080,160,"kfc",880],
 ["kfc-pepsi","k","Pepsi (KFC regular)","1",160,0,"cold drink",400],
 ["mc-veggie","k","McVeggie burger","1",400,10,"mcdonalds",170],
 ["mc-spicy-chicken","k","McSpicy Chicken burger","1",520,22,"mcdonalds",200],
 ["mc-spicy-paneer","k","McSpicy Paneer burger","1",560,20,"mcdonalds",200],
 ["maharaja-mac","k","Chicken Maharaja Mac","1",690,32,"mcdonalds",270],
 ["filet-o-fish","k","Filet-O-Fish","1",350,15,"mcdonalds fish",140],
 ["mc-nuggets","k","Chicken McNuggets","6 pcs",270,14,"mcdonalds",100],
 ["mc-fries","k","McDonald's fries","medium",340,4,"mcdonalds",115],
 ["mcflurry","k","McFlurry Oreo","1",280,6,"mcdonalds ice cream",180],
 ["soft-serve","k","Soft serve cone","1",150,4,"mcdonalds ice cream",90],
 ["pizza-pepperoni","k","Pizza, pepperoni / chicken sausage","1 slice (medium)",250,11,"dominos",95],
 ["pizza-farmhouse","k","Pizza, Farmhouse / veg loaded","1 slice (medium)",210,8,"dominos",90],
 ["garlic-bread","k","Garlic breadsticks","1 piece",120,3,"dominos",30],
 ["choco-lava","k","Choco lava cake","1",350,5,"dominos",90],
 ["whopper","k","Burger King Whopper","1",640,28,"bk",270],
 ["bk-chicken","k","Burger King Chicken burger","1",450,18,"bk",180],
 ["subway-teriyaki","k","Subway Chicken Teriyaki 6-inch","1",370,26,"sub",230],
 ["subway-veggie","k","Subway Veggie Delite 6-inch","1",230,9,"sub",200],
 ["subway-tikka","k","Subway Chicken Tikka 6-inch","1",340,24,"sub",220],
 # packaged
 ["kurkure","s","Kurkure","small pack (30 g)",160,2,"namkeen",30],
 ["aloo-bhujia","s","Haldiram aloo bhujia","30 g",170,4,"namkeen bhujia",30],
 ["oreo","s","Oreo","3 biscuits",160,2,"biscuit",32],
 ["hide-seek","s","Hide & Seek","3 biscuits",140,2,"biscuit chocolate chip",30],
 ["good-day","s","Good Day cookies","3",150,2,"biscuit",30],
 ["kitkat","w","KitKat","2 fingers",95,1,"chocolate",18],
 ["five-star","w","5 Star","1 small bar",110,1,"chocolate",22],
 ["ice-cream-cup","w","Ice cream cup","100 ml cup",150,3,"amul kwality walls",65],
 ["frooti","r","Frooti / Maaza","1 tetra (160 ml)",105,0,"mango drink",160],
 ["red-bull","r","Red Bull / energy drink","250 ml can",115,0,"",250],
 ["amul-kool","r","Flavoured milk (Amul Kool)","200 ml",180,6,"milk",200],
 ["nimbu-pani","r","Nimbu pani (with sugar)","1 glass",60,0,"lemonade shikanji",250],
]
foods = []
for row in cur["rows"] + [r[:7] for r in EXTRA]:
    fid, c, n, u, k, p, a = row
    g = G.get(fid) or {r[0]: r[7] for r in EXTRA}.get(fid) or (150 if "katori" in u else None)
    if g is None:
        raise SystemExit("no grams for " + fid)
    lab = u if u != "1" else "1 piece"
    foods.append(dict(id=fid, c=c, n=n, a=a, k=r1(k / g * 100), p=r1(p / g * 100), u=units_for(lab, g, c), s=0))

def norm(s):
    s = re.sub(r"\(.*?\)", " ", s.lower())
    return " ".join(sorted(w for w in re.split(r"[^a-z]+", s) if w and w not in ("with", "and", "ka", "ki", "ke", "the", "a", "of", "in")))

taken = set()
for f in foods:
    for part in f["n"].split("/"):
        taken.add(norm(part))

# ---------------------------------------------------------------- 2. INDB dishes
d = pd.read_excel(INDB)
SWEET_DRY = r"ladoo|laddoo|laddu|burfi|barfi|biscuit|cookie|cake|chikki|halwa|mathri|namkeen|sev|chakli|murukku|khakhra|peanut|chiwda|chivda|mixture|toffee|candy|fudge|pinni|panjiri|gajak|chocolate|pastry|pie|tart|brownie|muffin|bread|rusk|shortbread|crackers|nankhatai|mysore pak|soan|peda|kalakand|gujiya|gunjia|shakarpara|namak para|khaja|balushahi"
SKIP = r"masala$|masala powder|chutney powder|podi|stock$|baking powder|sauce$|dressing|syrup$|squash$|essence|vinegar|jam$|murabba|pickle|achar|preserve|weaning|sattu mix|premix|infant|baby food"

def cat_of(n):
    s = n.lower()
    rules = [
        ("z", r"soup|shorba|rasam|salad|consomme|broth"),
        ("r", r"\btea\b|chai|coffee|lassi|shake|smoothie|juice|sharbat|sherbet|panna|punch|lemonade|nimbu pani|jal jeera|jaljeera|cooler|thandai|buttermilk|chaas|chhach|drink|milk$|mocktail|kanji|soda|float|frappe"),
        ("w", r"\bkheer\b|payasam|halwa|ladoo|laddoo|laddu|burfi|barfi|jalebi|gulab jamun|rasgulla|rasmalai|sandesh|kulfi|ice cream|ice-cream|pudding|custard|mousse|souffle(?!.*(fish|chicken|cheese|spinach))|trifle|shrikhand|phirni|firni|peda|kalakand|malpua|gujiya|gunjia|sweet|mithai|fudge|toffee|candy|meringue|sundae|jelly|caramel|basundi|rabri|kesari|sheera|modak|chikki|gajak|pinni|halva"),
        ("x", r"chow ?mein|noodle|manchurian|chilli chicken|chilli paneer|fried rice|hakka|schezwan|szechuan|spring roll|momo|chop suey|sweet and sour|sweet & sour|wonton|dim sum|american chopsuey|stir fry|stir-fry|chinese"),
        ("c", r"chicken|mutton|lamb|keema|kheema|meat|kebab|kabab|gushtaba|rogan|yakhni|nihari|pork|beef|seekh|boti|tikka(?!.*paneer)|murg"),
        ("f", r"fish|prawn|shrimp|crab|machli|machhli|jhinga|\begg|anda|omelette|omlet"),
        ("e", r"sandwich|burger|pizza|pasta|spaghetti|macaroni|lasagne|lasagna|casserole|au gratin|pie|quiche|toast|cake|cookie|biscuit|muffin|brownie|tart|pastry|bread|bun|croissant|pancake|waffle|french|cutlet|patties|patty|hot dog|cheese|baked|roast|stew|risotto|sizzler|nachos|wrap|crepe"),
        ("g", r"roti|chapati|chapatti|phulka|paratha|parantha|parotta|naan|kulcha|puri|poori|bhatura|thepla|rice|pulao|pilaf|biryani|biriyani|khichdi|khichri|bhaat|bhath|bhat\b|sadam|\banna\b|pongal"),
        ("b", r"poha|upma|idli|dosa|uttapam|uthappam|vada|appam|cheela|chilla|dhokla|paniyaram|pesarattu|puttu|idiyappam|porridge|daliya|dalia|oats|muesli|cornflakes|flakes|sevai|semiya"),
        ("s", r"pakora|pakoda|bhajji|bhaji|samosa|kachori|chaat|chat\b|bhel|pani puri|golgappa|tikki|bonda|kachori|namkeen|sev|chakli|murukku|khakhra|mathri|chiwda|chivda|mixture|nuts|makhana|popcorn|chips|fritter|muthia|khandvi|handvo|vada pav|roll"),
        ("d", r"dal|daal|curry|sabzi|sabji|subzi|paneer|chole|chana|rajma|kadhi|sambar|sambhar|raita|bharta|aloo|gobi|bhindi|palak|saag|kofta|korma|masala|makhani|bhaji|poriyal|thoran|avial|kootu|undhiyu|stuffed|bharwa|dry|gravy|vegetable|veg|mushroom|beans|peas|matar|karela|lauki|tinda|baingan|brinjal|pumpkin|kaddu|cabbage|capsicum|jackfruit|kathal|yam|arbi|lobia|moong|masoor|urad|toor|arhar|sprout"),
    ]
    for c, rx in rules:
        if re.search(rx, s):
            return c
    return "e"

UNITMAP_BOWL = {"bowl", "curry bowl", "small bowl", "soup bowl"}
UNITMAP_PLATE = {"plate", "dish", "shallow dish", "casserole dish", "small casserole dish", "small plate", "souffle dish", "portion"}
UNITMAP_GLASS = {"glass", "tall glass", "juice glass", "tall stemmed glass", "half-pints"}
UNITMAP_CUP = {"tea cup", "cup"}
PIECE_NAMES = {"triangle": "sandwich triangle", "toasted triangle": "toast triangle", "parantha": "paratha", "poori": "puri", "ice-cream cup": "ice cream cup"}

def indb_units(unit, g, c):
    unit = (unit or "").strip().lower() if isinstance(unit, str) else ""
    u = []
    if unit in UNITMAP_BOWL or c in ("d",) and not unit:
        u = [["1 katori (150 g)", 150], ["1 bowl (250 g)", 250]]
        if unit == "soup bowl": u = [["1 bowl (250 g)", 250], ["1 katori (150 g)", 150]]
    elif unit in UNITMAP_PLATE:
        u = [["1 plate (250 g)", 250], ["1 katori (150 g)", 150]]
    elif unit in UNITMAP_GLASS:
        u = [["1 glass (250 ml)", 250], ["1 cup (150 ml)", 150]]
    elif unit in UNITMAP_CUP:
        u = [["1 cup (150 ml)", 150], ["1 glass (250 ml)", 250]]
    elif unit == "tablespoon":
        u = [["1 tbsp (15 g)", 15]]
    elif unit == "teaspoon":
        u = [["1 tsp (5 g)", 5]]
    elif unit and g == g and 8 <= g <= 300 and unit not in ("gm", "ml", "jar", "glass jar", "box"):
        nm = PIECE_NAMES.get(unit, unit)
        u = [[f"1 {nm} ({round(g)} g)", round(g)]]
    elif c == "g" or c == "x":
        u = [["1 plate (250 g)", 250], ["1 katori (150 g)", 150]]
    u.append(["100 g", 100])
    return u

def plausible(n, k, p):
    s = n.lower()
    if not (15 <= k <= 600): return False
    if k > 350:
        if not re.search(SWEET_DRY, s): return False
        if k > 560 and not re.search(r"chikki|peanut|nut|chiwda|chivda|mixture|sev|chakli|murukku|chocolate|namkeen|khakhra", s): return False
    if re.search(r"chicken|mutton|fish|keema|meat|prawn|lamb|kebab|kabab", s) and p < 5 and not re.search(r"soup|stock|sandwich|pie", s): return False
    if re.search(r"\begg\b|anda", s) and k < 80 and not re.search(r"soup|nog|sauce", s): return False
    return True

n_indb = 0
for _, r in d.iterrows():
    name = str(r.food_name).strip()
    name = re.sub(r"\s+", " ", name)
    k, p = float(r.energy_kcal), float(r.protein_g)
    if re.search(SKIP, name.lower()): continue
    if not plausible(name, k, p): continue
    if norm(name) in taken or norm(re.sub(r"\(.*?\)", "", name)) in taken: continue
    paren = " ".join(re.findall(r"\((.*?)\)", name)).lower()
    c = cat_of(name)
    g = (r.unit_serving_energy_kcal / r.energy_kcal * 100) if r.energy_kcal else float("nan")
    foods.append(dict(id="in-" + str(r.food_code).lower(), c=c, n=name, a=paren.replace("/", " "), k=r1(k), p=r1(p), u=indb_units(r.servings_unit, g, c), s=1))
    taken.add(norm(name)); n_indb += 1

# ---------------------------------------------------------------- 3. IFCT raw foods
f = pd.read_csv(IFCT)
GROUP = {"Fruits": "u", "Other Vegetables": "v", "Green Leafy Vegetables": "v", "Roots and Tubers": "v", "Mushrooms": "v",
         "Animal Meat": "q", "Poultry": "q", "Marine Fish": "q", "Fresh Water Fish and Shellfish": "q", "Marine Shellfish": "q", "Marine Mollusks": "q",
         "Cereals and Millets": "y", "Grain Legumes": "y", "Nuts and Oil Seeds": "u", "Egg and Egg Products": "f",
         "Milk and Milk Products": "o", "Edible Oils and Fats": "o", "Sugars": "o"}

def lang_aliases(s):
    if not isinstance(s, str): return ""
    s = re.sub(r"\[.*?\]", "", s)
    out = []
    for part in s.split(";"):
        m = re.match(r"\s*(A|B|H|E|Common)\.\s*(.*)", part)
        if m: out.append(m.group(2))
    return re.sub(r"\s+", " ", " ".join(out).replace(",", " ")).strip().lower()

rows = {}
for _, r in f.iterrows():
    c = GROUP.get(r.grup)
    if not c: continue
    base = re.sub(r"[\s-]*\d+$", "", str(r["name"]).strip())
    key = (c, base)
    e = rows.setdefault(key, dict(k=[], p=[], a=set(), code=r.code))
    e["k"].append(float(r.enerc) / 4.184); e["p"].append(float(r.protcnt) if r.protcnt == r.protcnt else 0.0)
    e["a"].add(lang_aliases(r.lang))

n_raw = 0
for (c, base), e in rows.items():
    k = sum(e["k"]) / len(e["k"]); p = sum(e["p"]) / len(e["p"])
    if k <= 0: continue
    name = base + (" (raw)" if c in ("v", "q", "y") or (c == "f" and "boiled" not in base.lower()) else "")
    if c in ("o",) and re.search(r"oil|ghee|butter|vanaspati|fat", base.lower()):
        u = [["1 tsp (5 g)", 5], ["1 tbsp (15 g)", 15], ["100 g", 100]]
    elif c == "f":
        u = [["1 egg (50 g)", 50], ["100 g", 100]]
    elif c == "u" and re.search(r"\bnuts?\b|almond|cashew|walnut|pista|groundnut|\bseeds?\b", base.lower()):
        u = [["1 handful (30 g)", 30], ["100 g", 100]]
    elif c == "y":
        u = [["1 katori raw (50 g)", 50], ["100 g", 100]]
    else:
        u = [["100 g", 100]]
    al = " ".join(sorted(a for a in e["a"] if a))[:160]
    foods.append(dict(id="nin-" + str(e["code"]).lower(), c=c, n=name, a=al, k=r1(k), p=r1(p), u=u, s=2))
    n_raw += 1

# ---------------------------------------------------------------- write
rowsjs = [[x["id"], x["c"], x["n"], x["a"], x["k"], x["p"], x["u"], x["s"]] for x in foods]
js = ("/* Food list for the Weight page. GENERATED by tools/build-foods.py, do not edit by hand.\n"
      "   Values are per 100 g with household portions [label, grams].\n"
      "   Sources: curated common portions (s=0); Indian Nutrient Databank 2024 recipes (s=1);\n"
      "   NIN Indian Food Composition Tables 2017 raw foods (s=2). All values approximate. */\n"
      "window.FOODS=(function(){\nconst C=" + json.dumps(CATS, ensure_ascii=False) + ";\nconst R=" +
      json.dumps(rowsjs, ensure_ascii=False, separators=(",", ":")) +
      ";\nreturn {cats:C,list:R.map(r=>({id:r[0],c:r[1],n:r[2],a:r[3],k:r[4],p:r[5],units:r[6],s:r[7]}))};\n})();\n")
open("foods.js", "w").write(js)
print(f"curated {len([x for x in foods if x['s']==0])}, dishes {n_indb}, raw {n_raw}, total {len(foods)}, {len(js)//1024} KB")
