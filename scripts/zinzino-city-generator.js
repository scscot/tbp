#!/usr/bin/env node
/**
 * Zinzino City Data Generator/Validator
 *
 * Generates and validates city data for Zinzino Partner Search scraping.
 * Uses a tiered approach based on country population/market size:
 *
 * - Tier 1 (100 cities): US, Germany, UK - Largest markets
 * - Tier 2 (50 cities): Large population countries
 * - Tier 3 (30 cities): Medium markets
 * - Tier 4 (15 cities): Smaller countries
 *
 * Usage:
 *   node scripts/zinzino-city-generator.js                # Show stats
 *   node scripts/zinzino-city-generator.js --list         # List all countries
 *   node scripts/zinzino-city-generator.js --country=de   # Show cities for Germany
 *   node scripts/zinzino-city-generator.js --validate     # Validate data integrity
 *   node scripts/zinzino-city-generator.js --generate     # Regenerate cities JSON
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CITIES_FILE = path.join(__dirname, 'data/zinzino-cities.json');

// Tier definitions based on country market size
const TIERS = {
  // Tier 1: 100 cities - Largest Zinzino markets
  tier1: ['us', 'de', 'gb'],

  // Tier 2: 50 cities - Large population countries
  tier2: ['fr', 'it', 'es', 'pl', 'ca', 'au', 'mx', 'in', 'cn', 'ph', 'tr', 'kr', 'th', 'my', 'za', 'co', 'pe'],

  // Tier 3: 30 cities - Medium markets
  tier3: ['nl', 'be', 'cz', 'gr', 'hu', 'se', 'at', 'ch', 'ro', 'tw', 'ie', 'no', 'nz', 'sg'],

  // Tier 4: 15 cities - Smaller countries
  tier4: ['dk', 'fi', 'fo', 'is', 'ee', 'lv', 'lt', 'cy', 'lu', 'mt', 'rs', 'si', 'sk', 'hk']
};

function getTierForCountry(code) {
  if (TIERS.tier1.includes(code)) return { tier: 1, cities: 100 };
  if (TIERS.tier2.includes(code)) return { tier: 2, cities: 50 };
  if (TIERS.tier3.includes(code)) return { tier: 3, cities: 30 };
  return { tier: 4, cities: 15 };
}

// ============================================================================
// EXPANDED CITY DATA BY COUNTRY
// All city names in their native language where applicable
// ============================================================================

const EXPANDED_CITY_DATA = {
  // TIER 1 - 100 CITIES
  us: {
    name: "United States",
    locale: "en-US",
    cities: [
      // Top 20
      "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
      "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose",
      "Austin", "Jacksonville", "Fort Worth", "Columbus", "Charlotte",
      "Indianapolis", "San Francisco", "Seattle", "Denver", "Boston",
      // 21-40
      "El Paso", "Nashville", "Detroit", "Oklahoma City", "Portland",
      "Las Vegas", "Memphis", "Louisville", "Baltimore", "Milwaukee",
      "Albuquerque", "Tucson", "Fresno", "Sacramento", "Mesa",
      "Kansas City", "Atlanta", "Miami", "Colorado Springs", "Raleigh",
      // 41-60
      "Omaha", "Long Beach", "Virginia Beach", "Oakland", "Minneapolis",
      "Tulsa", "Tampa", "Arlington", "New Orleans", "Wichita",
      "Cleveland", "Bakersfield", "Aurora", "Anaheim", "Honolulu",
      "Santa Ana", "Riverside", "Corpus Christi", "Lexington", "Henderson",
      // 61-80
      "Stockton", "Saint Paul", "Cincinnati", "St. Louis", "Pittsburgh",
      "Greensboro", "Lincoln", "Anchorage", "Plano", "Orlando",
      "Irvine", "Newark", "Durham", "Chula Vista", "Toledo",
      "Fort Wayne", "St. Petersburg", "Laredo", "Jersey City", "Chandler",
      // 81-100
      "Madison", "Lubbock", "Scottsdale", "Reno", "Buffalo",
      "Gilbert", "Glendale", "North Las Vegas", "Winston-Salem", "Chesapeake",
      "Norfolk", "Fremont", "Garland", "Irving", "Hialeah",
      "Richmond", "Boise", "Spokane", "Baton Rouge", "Tacoma"
    ]
  },

  de: {
    name: "Germany",
    locale: "de-DE",
    cities: [
      // Top 20
      "Berlin", "Hamburg", "München", "Köln", "Frankfurt",
      "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Essen",
      "Bremen", "Dresden", "Hannover", "Nürnberg", "Duisburg",
      "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster",
      // 21-40
      "Mannheim", "Karlsruhe", "Augsburg", "Wiesbaden", "Mönchengladbach",
      "Gelsenkirchen", "Aachen", "Braunschweig", "Chemnitz", "Kiel",
      "Krefeld", "Halle", "Magdeburg", "Freiburg", "Oberhausen",
      "Lübeck", "Erfurt", "Rostock", "Mainz", "Kassel",
      // 41-60
      "Hagen", "Saarbrücken", "Hamm", "Mülheim", "Potsdam",
      "Ludwigshafen", "Oldenburg", "Osnabrück", "Leverkusen", "Heidelberg",
      "Solingen", "Darmstadt", "Herne", "Regensburg", "Neuss",
      "Paderborn", "Ingolstadt", "Offenbach", "Würzburg", "Fürth",
      // 61-80
      "Ulm", "Heilbronn", "Pforzheim", "Wolfsburg", "Göttingen",
      "Bottrop", "Reutlingen", "Koblenz", "Bremerhaven", "Erlangen",
      "Bergisch Gladbach", "Remscheid", "Trier", "Recklinghausen", "Jena",
      "Moers", "Salzgitter", "Siegen", "Gütersloh", "Hildesheim",
      // 81-100
      "Cottbus", "Kaiserslautern", "Witten", "Gera", "Schwerin",
      "Iserlohn", "Esslingen", "Ludwigsburg", "Düren", "Zwickau",
      "Ratingen", "Marl", "Lünen", "Hanau", "Flensburg",
      "Velbert", "Minden", "Tübingen", "Villingen-Schwenningen", "Konstanz"
    ]
  },

  gb: {
    name: "United Kingdom",
    locale: "en-GB",
    cities: [
      // Top 20
      "London", "Birmingham", "Manchester", "Leeds", "Glasgow",
      "Liverpool", "Newcastle", "Sheffield", "Bristol", "Edinburgh",
      "Leicester", "Coventry", "Bradford", "Cardiff", "Belfast",
      "Nottingham", "Kingston upon Hull", "Stoke-on-Trent", "Southampton", "Derby",
      // 21-40
      "Portsmouth", "Brighton", "Plymouth", "Wolverhampton", "Reading",
      "Aberdeen", "Northampton", "Luton", "Swindon", "Bournemouth",
      "Dundee", "Middlesbrough", "Sunderland", "Warrington", "Milton Keynes",
      "Swansea", "Peterborough", "Oxford", "Cambridge", "York",
      // 41-60
      "Ipswich", "Norwich", "Gloucester", "Exeter", "Blackpool",
      "Huddersfield", "Birkenhead", "Southend-on-Sea", "Blackburn", "Bolton",
      "Newport", "Preston", "Stockport", "Telford", "Slough",
      "Watford", "Rotherham", "Maidstone", "Basildon", "Crawley",
      // 61-80
      "Colchester", "Chelmsford", "Eastbourne", "Worcester", "Lincoln",
      "Doncaster", "Bath", "Oldham", "Rochdale", "Wigan",
      "Chester", "St Helens", "Salford", "Gateshead", "Solihull",
      "High Wycombe", "Sutton Coldfield", "Wakefield", "Dudley", "Hartlepool",
      // 81-100
      "Halifax", "Darlington", "Grimsby", "Barnsley", "Scunthorpe",
      "Cheltenham", "Woking", "Basingstoke", "Bedford", "Harrogate",
      "Stevenage", "Hemel Hempstead", "Worthing", "Hastings", "Southport",
      "Carlisle", "Inverness", "Perth", "Stirling", "Dumfries"
    ]
  },

  // TIER 2 - 50 CITIES
  fr: {
    name: "France",
    locale: "fr-FR",
    cities: [
      "Paris", "Marseille", "Lyon", "Toulouse", "Nice",
      "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Lille",
      "Rennes", "Reims", "Saint-Étienne", "Le Havre", "Toulon",
      "Grenoble", "Dijon", "Angers", "Nîmes", "Villeurbanne",
      "Clermont-Ferrand", "Le Mans", "Aix-en-Provence", "Brest", "Tours",
      "Amiens", "Limoges", "Annecy", "Perpignan", "Boulogne-Billancourt",
      "Metz", "Besançon", "Orléans", "Rouen", "Mulhouse",
      "Caen", "Nancy", "Saint-Denis", "Argenteuil", "Montreuil",
      "Roubaix", "Tourcoing", "Avignon", "Dunkerque", "Créteil",
      "Poitiers", "Nanterre", "Versailles", "Pau", "La Rochelle"
    ]
  },

  it: {
    name: "Italy",
    locale: "it-IT",
    cities: [
      "Roma", "Milano", "Napoli", "Torino", "Palermo",
      "Genova", "Bologna", "Firenze", "Bari", "Catania",
      "Venezia", "Verona", "Messina", "Padova", "Trieste",
      "Brescia", "Taranto", "Prato", "Parma", "Modena",
      "Reggio Calabria", "Reggio Emilia", "Perugia", "Livorno", "Ravenna",
      "Cagliari", "Foggia", "Rimini", "Salerno", "Ferrara",
      "Sassari", "Latina", "Monza", "Siracusa", "Pescara",
      "Bergamo", "Forlì", "Trento", "Vicenza", "Terni",
      "Bolzano", "Novara", "Piacenza", "Ancona", "Andria",
      "Arezzo", "Udine", "Cesena", "Lecce", "La Spezia"
    ]
  },

  es: {
    name: "Spain",
    locale: "es-ES",
    cities: [
      "Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza",
      "Málaga", "Murcia", "Palma", "Las Palmas", "Bilbao",
      "Alicante", "Córdoba", "Valladolid", "Vigo", "Gijón",
      "L'Hospitalet", "A Coruña", "Granada", "Vitoria", "Elche",
      "Oviedo", "Santa Cruz de Tenerife", "Badalona", "Cartagena", "Terrassa",
      "Jerez de la Frontera", "Sabadell", "Móstoles", "Alcalá de Henares", "Pamplona",
      "Fuenlabrada", "Almería", "Leganés", "San Sebastián", "Getafe",
      "Burgos", "Santander", "Castellón de la Plana", "Albacete", "Alcorcón",
      "San Cristóbal de La Laguna", "Logroño", "Badajoz", "Salamanca", "Huelva",
      "Marbella", "Lleida", "Tarragona", "León", "Cádiz"
    ]
  },

  pl: {
    name: "Poland",
    locale: "pl-PL",
    cities: [
      "Warszawa", "Kraków", "Łódź", "Wrocław", "Poznań",
      "Gdańsk", "Szczecin", "Bydgoszcz", "Lublin", "Białystok",
      "Katowice", "Gdynia", "Częstochowa", "Radom", "Toruń",
      "Sosnowiec", "Rzeszów", "Kielce", "Gliwice", "Olsztyn",
      "Zabrze", "Bielsko-Biała", "Bytom", "Zielona Góra", "Rybnik",
      "Ruda Śląska", "Opole", "Tychy", "Płock", "Dąbrowa Górnicza",
      "Elbląg", "Wałbrzych", "Włocławek", "Tarnów", "Chorzów",
      "Koszalin", "Kalisz", "Legnica", "Grudziądz", "Jaworzno",
      "Słupsk", "Jastrzębie-Zdrój", "Nowy Sącz", "Jelenia Góra", "Siedlce",
      "Mysłowice", "Piła", "Ostrów Wielkopolski", "Lubin", "Stargard"
    ]
  },

  ca: {
    name: "Canada",
    locale: "en-CA",
    cities: [
      "Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton",
      "Ottawa", "Winnipeg", "Quebec City", "Hamilton", "Kitchener",
      "London", "Victoria", "Halifax", "Oshawa", "Windsor",
      "Saskatoon", "Regina", "St. Catharines", "Kelowna", "Barrie",
      "Sherbrooke", "Guelph", "Abbotsford", "Kingston", "Trois-Rivières",
      "Moncton", "Chicoutimi", "Milton", "Red Deer", "Brantford",
      "Thunder Bay", "White Rock", "Nanaimo", "Kamloops", "Sudbury",
      "Prince George", "Lethbridge", "Medicine Hat", "Saint John", "Peterborough",
      "Chilliwack", "Sarnia", "Belleville", "Fredericton", "Sault Ste. Marie",
      "Fort McMurray", "North Bay", "Drummondville", "Saint-Jérôme", "Granby"
    ]
  },

  au: {
    name: "Australia",
    locale: "en-AU",
    cities: [
      "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide",
      "Gold Coast", "Newcastle", "Canberra", "Wollongong", "Hobart",
      "Geelong", "Townsville", "Cairns", "Darwin", "Toowoomba",
      "Ballarat", "Bendigo", "Albury", "Launceston", "Mackay",
      "Rockhampton", "Bunbury", "Bundaberg", "Hervey Bay", "Wagga Wagga",
      "Coffs Harbour", "Mildura", "Shepparton", "Port Macquarie", "Tamworth",
      "Orange", "Dubbo", "Geraldton", "Nowra", "Bathurst",
      "Warrnambool", "Albany", "Gladstone", "Kalgoorlie", "Mount Gambier",
      "Lismore", "Maitland", "Busselton", "Armidale", "Goulburn",
      "Traralgon", "Whyalla", "Burnie", "Devonport", "Alice Springs"
    ]
  },

  mx: {
    name: "Mexico",
    locale: "es-MX",
    cities: [
      "Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana",
      "León", "Ciudad Juárez", "Zapopan", "Mérida", "San Luis Potosí",
      "Aguascalientes", "Hermosillo", "Saltillo", "Mexicali", "Culiacán",
      "Querétaro", "Morelia", "Chihuahua", "Cancún", "Acapulco",
      "Tlalnepantla", "Naucalpan", "Toluca", "Torreón", "Durango",
      "Mazatlán", "Veracruz", "Tuxtla Gutiérrez", "Reynosa", "Tlaquepaque",
      "Ecatepec", "Irapuato", "Celaya", "Cuernavaca", "Ensenada",
      "Tampico", "Xalapa", "Villahermosa", "Oaxaca", "Nuevo Laredo",
      "Victoria", "Matamoros", "Tepic", "Los Mochis", "Pachuca",
      "Campeche", "La Paz", "Colima", "Zacatecas", "Guanajuato"
    ]
  },

  in: {
    name: "India",
    locale: "en-IN",
    cities: [
      "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai",
      "Kolkata", "Ahmedabad", "Pune", "Surat", "Jaipur",
      "Lucknow", "Kanpur", "Nagpur", "Patna", "Indore",
      "Thane", "Bhopal", "Visakhapatnam", "Vadodara", "Coimbatore",
      "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad",
      "Meerut", "Rajkot", "Varanasi", "Srinagar", "Aurangabad",
      "Dhanbad", "Amritsar", "Navi Mumbai", "Allahabad", "Ranchi",
      "Howrah", "Gwalior", "Jabalpur", "Jodhpur", "Raipur",
      "Kota", "Chandigarh", "Guwahati", "Solapur", "Hubli",
      "Mysore", "Tiruchirappalli", "Bareilly", "Aligarh", "Moradabad"
    ]
  },

  cn: {
    name: "China",
    locale: "zh-CN",
    cities: [
      "Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Chengdu",
      "Tianjin", "Wuhan", "Dongguan", "Chongqing", "Nanjing",
      "Hangzhou", "Shenyang", "Xi'an", "Harbin", "Suzhou",
      "Qingdao", "Dalian", "Zhengzhou", "Jinan", "Changsha",
      "Kunming", "Fuzhou", "Ürümqi", "Changchun", "Shijiazhuang",
      "Ningbo", "Taiyuan", "Nanning", "Guiyang", "Hefei",
      "Foshan", "Nanchang", "Lanzhou", "Wenzhou", "Wuxi",
      "Xiamen", "Shantou", "Zhuhai", "Huizhou", "Zhongshan",
      "Jiangmen", "Yantai", "Tangshan", "Hohhot", "Baotou",
      "Haikou", "Luoyang", "Liuzhou", "Xuzhou", "Changzhou"
    ]
  },

  ph: {
    name: "Philippines",
    locale: "en-PH",
    cities: [
      "Manila", "Quezon City", "Davao City", "Caloocan", "Cebu City",
      "Zamboanga City", "Taguig", "Antipolo", "Pasig", "Cagayan de Oro",
      "Parañaque", "Dasmariñas", "Valenzuela", "Bacoor", "General Santos",
      "Las Piñas", "Makati", "San Jose del Monte", "Bacolod", "Muntinlupa",
      "Calamba", "Lapu-Lapu", "Angeles", "Iloilo City", "Marikina",
      "Pasay", "Malabon", "Santa Rosa", "Imus", "Baguio",
      "Navotas", "Biñan", "San Fernando", "Lipa", "Cainta",
      "Batangas City", "General Trias", "Tarlac City", "Iligan", "Mandaluyong",
      "Mandaue", "Olongapo", "Butuan", "Puerto Princesa", "Naga",
      "San Pablo", "Talisay", "Tagum", "Meycauayan", "Lucena"
    ]
  },

  tr: {
    name: "Turkey",
    locale: "tr-TR",
    cities: [
      "Istanbul", "Ankara", "Izmir", "Bursa", "Adana",
      "Gaziantep", "Konya", "Antalya", "Kayseri", "Mersin",
      "Eskişehir", "Diyarbakır", "Samsun", "Denizli", "Şanlıurfa",
      "Adapazarı", "Malatya", "Kahramanmaraş", "Erzurum", "Van",
      "Batman", "Elazığ", "Sivas", "Manisa", "Balıkesir",
      "Trabzon", "Gebze", "Kocaeli", "Çorum", "Osmaniye",
      "Hatay", "Adıyaman", "Kırıkkale", "Ordu", "Aydın",
      "Muğla", "Aksaray", "Afyon", "Tokat", "Uşak",
      "Isparta", "Giresun", "Yozgat", "Edirne", "Düzce",
      "Karaman", "Kastamonu", "Rize", "Niğde", "Bolu"
    ]
  },

  kr: {
    name: "South Korea",
    locale: "ko-KR",
    cities: [
      "Seoul", "Busan", "Incheon", "Daegu", "Daejeon",
      "Gwangju", "Suwon", "Ulsan", "Changwon", "Seongnam",
      "Goyang", "Yongin", "Bucheon", "Ansan", "Cheongju",
      "Jeonju", "Anyang", "Cheonan", "Namyangju", "Hwaseong",
      "Gimhae", "Jeju", "Pohang", "Uijeongbu", "Siheung",
      "Pyeongtaek", "Gwangmyeong", "Gimpo", "Wonju", "Iksan",
      "Yangsan", "Asan", "Gunpo", "Gyeongju", "Guri",
      "Sejong", "Chuncheon", "Gunsan", "Geoje", "Hanam",
      "Mokpo", "Yeosu", "Suncheon", "Yangju", "Osan",
      "Gyeongsan", "Uiwang", "Gangneung", "Gwangyang", "Icheon"
    ]
  },

  th: {
    name: "Thailand",
    locale: "th-TH",
    cities: [
      "Bangkok", "Nonthaburi", "Pak Kret", "Hat Yai", "Chiang Mai",
      "Udon Thani", "Nakhon Ratchasima", "Khon Kaen", "Chon Buri", "Surat Thani",
      "Pattaya", "Nakhon Si Thammarat", "Ubon Ratchathani", "Phuket", "Rayong",
      "Samut Prakan", "Nakhon Pathom", "Songkhla", "Phitsanulok", "Chiang Rai",
      "Lampang", "Nakhon Sawan", "Ratchaburi", "Prachuap Khiri Khan", "Saraburi",
      "Kanchanaburi", "Lopburi", "Trang", "Pathum Thani", "Krabi",
      "Ayutthaya", "Suphan Buri", "Phetchaburi", "Roi Et", "Yasothon",
      "Sakon Nakhon", "Maha Sarakham", "Nong Khai", "Buriram", "Chaiyaphum",
      "Surin", "Uttaradit", "Chachoengsao", "Nakhon Phanom", "Samut Sakhon",
      "Phrae", "Nan", "Ranong", "Chumphon", "Narathiwat"
    ]
  },

  my: {
    name: "Malaysia",
    locale: "ms-MY",
    cities: [
      "Kuala Lumpur", "George Town", "Ipoh", "Shah Alam", "Petaling Jaya",
      "Johor Bahru", "Malacca City", "Kota Kinabalu", "Kuching", "Subang Jaya",
      "Klang", "Seremban", "Kuantan", "Alor Setar", "Kuala Terengganu",
      "Kota Bharu", "Miri", "Taiping", "Sibu", "Sandakan",
      "Kajang", "Ampang", "Batu Caves", "Sungai Petani", "Tawau",
      "Kulim", "Butterworth", "Kemaman", "Bintulu", "Kangar",
      "Lahad Datu", "Teluk Intan", "Port Dickson", "Rawang", "Sepang",
      "Nilai", "Temerloh", "Segamat", "Bentong", "Pasir Gudang",
      "Bangi", "Seri Kembangan", "Banting", "Semenyih", "Puchong",
      "Cheras", "Putrajaya", "Cyberjaya", "Setapak", "Kepong"
    ]
  },

  za: {
    name: "South Africa",
    locale: "en-ZA",
    cities: [
      "Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth",
      "Bloemfontein", "East London", "Nelspruit", "Kimberley", "Polokwane",
      "Rustenburg", "Pietermaritzburg", "George", "Potchefstroom", "Welkom",
      "Richards Bay", "Vereeniging", "Benoni", "Soweto", "Centurion",
      "Midrand", "Sandton", "Randburg", "Roodepoort", "Germiston",
      "Boksburg", "Krugersdorp", "Alberton", "Springs", "Witbank",
      "Middelburg", "Secunda", "Vanderbijlpark", "Stellenbosch", "Paarl",
      "Worcester", "Knysna", "Mossel Bay", "Oudtshoorn", "Upington",
      "Mafikeng", "Klerksdorp", "Newcastle", "Ladysmith", "Uitenhage",
      "Grahamstown", "Queenstown", "Umtata", "Tzaneen", "Musina"
    ]
  },

  co: {
    name: "Colombia",
    locale: "es-CO",
    cities: [
      "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena",
      "Cúcuta", "Bucaramanga", "Pereira", "Santa Marta", "Ibagué",
      "Pasto", "Manizales", "Neiva", "Villavicencio", "Armenia",
      "Valledupar", "Montería", "Sincelejo", "Popayán", "Floridablanca",
      "Palmira", "Buenaventura", "Soledad", "Itagüí", "Soacha",
      "Envigado", "Tuluá", "Dosquebradas", "Bello", "Riohacha",
      "Barrancabermeja", "Tunja", "Girardot", "Maicao", "Florencia",
      "Sogamoso", "Ciénaga", "Apartadó", "Magangué", "Girón",
      "Duitama", "Piedecuesta", "Cartago", "San Andrés", "Yopal",
      "Quibdó", "Facatativá", "Ocaña", "Aguachica", "Turbaco"
    ]
  },

  pe: {
    name: "Peru",
    locale: "es-PE",
    cities: [
      "Lima", "Arequipa", "Trujillo", "Chiclayo", "Piura",
      "Iquitos", "Cusco", "Chimbote", "Huancayo", "Tacna",
      "Juliaca", "Ica", "Pucallpa", "Sullana", "Chincha Alta",
      "Ayacucho", "Cajamarca", "Huánuco", "Puno", "Tarapoto",
      "Tumbes", "Huaraz", "Talara", "Pisco", "Jaén",
      "Paita", "Abancay", "Moyobamba", "Cerro de Pasco", "Puerto Maldonado",
      "Moquegua", "Chulucanas", "Huacho", "Barranca", "Chancay",
      "Andahuaylas", "Lambayeque", "Ferreñafe", "Yurimaguas", "Bagua Grande",
      "Tingo María", "Huancavelica", "Tarma", "La Oroya", "Sicuani",
      "Nazca", "Camaná", "Mollendo", "Ilave", "Chepén"
    ]
  },

  // TIER 3 - 30 CITIES
  nl: {
    name: "Netherlands",
    locale: "nl-NL",
    cities: [
      "Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven",
      "Tilburg", "Groningen", "Almere", "Breda", "Nijmegen",
      "Apeldoorn", "Haarlem", "Arnhem", "Enschede", "Amersfoort",
      "Zaanstad", "'s-Hertogenbosch", "Zwolle", "Haarlemmermeer", "Leiden",
      "Zoetermeer", "Maastricht", "Dordrecht", "Ede", "Leeuwarden",
      "Alphen aan den Rijn", "Westland", "Emmen", "Delft", "Deventer"
    ]
  },

  be: {
    name: "Belgium",
    locale: "fr-BE",
    cities: [
      "Brussels", "Antwerp", "Ghent", "Charleroi", "Liège",
      "Bruges", "Namur", "Leuven", "Mons", "Aalst",
      "Mechelen", "La Louvière", "Kortrijk", "Hasselt", "Ostend",
      "Sint-Niklaas", "Tournai", "Genk", "Seraing", "Roeselare",
      "Mouscron", "Verviers", "Beringen", "Dendermonde", "Turnhout",
      "Lokeren", "Herstal", "Châtelet", "Binche", "Waregem"
    ]
  },

  cz: {
    name: "Czech Republic",
    locale: "cs-CZ",
    cities: [
      "Praha", "Brno", "Ostrava", "Plzeň", "Liberec",
      "Olomouc", "České Budějovice", "Hradec Králové", "Ústí nad Labem", "Pardubice",
      "Zlín", "Havířov", "Kladno", "Most", "Opava",
      "Frýdek-Místek", "Karviná", "Jihlava", "Teplice", "Děčín",
      "Chomutov", "Karlovy Vary", "Přerov", "Mladá Boleslav", "Prostějov",
      "Jablonec nad Nisou", "Třebíč", "Česká Lípa", "Třinec", "Kolín"
    ]
  },

  gr: {
    name: "Greece",
    locale: "el-GR",
    cities: [
      "Athina", "Thessaloniki", "Patra", "Pireas", "Larisa",
      "Irakleio", "Peristeri", "Kallithea", "Acharnes", "Kalamaria",
      "Nikaia", "Glyfada", "Volos", "Ioannina", "Nea Smyrni",
      "Ilioupoli", "Keratsini", "Evosmos", "Chalandri", "Rodos",
      "Kerkyra", "Kavala", "Chania", "Agrinio", "Serres",
      "Alexandroupoli", "Katerini", "Trikala", "Lamia", "Kozani"
    ]
  },

  hu: {
    name: "Hungary",
    locale: "hu-HU",
    cities: [
      "Budapest", "Debrecen", "Szeged", "Miskolc", "Pécs",
      "Győr", "Nyíregyháza", "Kecskemét", "Székesfehérvár", "Szombathely",
      "Szolnok", "Tatabánya", "Kaposvár", "Érd", "Veszprém",
      "Békéscsaba", "Zalaegerszeg", "Sopron", "Eger", "Nagykanizsa",
      "Dunaújváros", "Hódmezővásárhely", "Dunakeszi", "Cegléd", "Baja",
      "Salgótarján", "Szigetszentmiklós", "Ózd", "Vác", "Mosonmagyaróvár"
    ]
  },

  se: {
    name: "Sweden",
    locale: "sv-SE",
    cities: [
      "Stockholm", "Göteborg", "Malmö", "Uppsala", "Linköping",
      "Västerås", "Örebro", "Norrköping", "Helsingborg", "Jönköping",
      "Umeå", "Lund", "Borås", "Huddinge", "Nacka",
      "Eskilstuna", "Södertälje", "Halmstad", "Gävle", "Växjö",
      "Sundsvall", "Karlstad", "Trollhättan", "Östersund", "Luleå",
      "Täby", "Kristianstad", "Kalmar", "Borlänge", "Skellefteå"
    ]
  },

  at: {
    name: "Austria",
    locale: "de-AT",
    cities: [
      "Wien", "Graz", "Linz", "Salzburg", "Innsbruck",
      "Klagenfurt", "Villach", "Wels", "Sankt Pölten", "Dornbirn",
      "Wiener Neustadt", "Steyr", "Feldkirch", "Bregenz", "Leonding",
      "Klosterneuburg", "Baden", "Wolfsberg", "Leoben", "Krems",
      "Traun", "Amstetten", "Lustenau", "Kapfenberg", "Mödling",
      "Hallein", "Braunau am Inn", "Kufstein", "Schwechat", "Traiskirchen"
    ]
  },

  ch: {
    name: "Switzerland",
    locale: "de-CH",
    cities: [
      "Zürich", "Genf", "Basel", "Lausanne", "Bern",
      "Winterthur", "Luzern", "St. Gallen", "Lugano", "Biel",
      "Thun", "Köniz", "La Chaux-de-Fonds", "Fribourg", "Schaffhausen",
      "Chur", "Vernier", "Neuchâtel", "Uster", "Sion",
      "Lancy", "Emmen", "Yverdon-les-Bains", "Zug", "Kriens",
      "Rapperswil-Jona", "Dübendorf", "Montreux", "Dietikon", "Frauenfeld"
    ]
  },

  ro: {
    name: "Romania",
    locale: "ro-RO",
    cities: [
      "București", "Cluj-Napoca", "Timișoara", "Iași", "Constanța",
      "Craiova", "Brașov", "Galați", "Ploiești", "Oradea",
      "Brăila", "Arad", "Pitești", "Sibiu", "Bacău",
      "Târgu Mureș", "Baia Mare", "Buzău", "Satu Mare", "Botoșani",
      "Râmnicu Vâlcea", "Suceava", "Drobeta-Turnu Severin", "Piatra Neamț", "Focșani",
      "Reșița", "Bistrița", "Tulcea", "Târgoviște", "Alba Iulia"
    ]
  },

  tw: {
    name: "Taiwan",
    locale: "zh-TW",
    cities: [
      "Taipei", "Kaohsiung", "Taichung", "Tainan", "Taoyuan",
      "Hsinchu", "Keelung", "Chiayi", "Changhua", "Pingtung",
      "Zhongli", "Fengyuan", "Yuanlin", "Douliu", "Taitung",
      "Hualien", "Nantou", "Yilan", "Miaoli", "Magong",
      "Zhubei", "Luzhou", "Sanchong", "Banqiao", "Xinzhuang",
      "Tucheng", "Zhonghe", "Yonghe", "Xindian", "Beitou"
    ]
  },

  ie: {
    name: "Ireland",
    locale: "en-IE",
    cities: [
      "Dublin", "Cork", "Limerick", "Galway", "Waterford",
      "Drogheda", "Swords", "Dundalk", "Bray", "Navan",
      "Kilkenny", "Ennis", "Carlow", "Tralee", "Newbridge",
      "Portlaoise", "Naas", "Athlone", "Mullingar", "Wexford",
      "Letterkenny", "Sligo", "Celbridge", "Clonmel", "Greystones",
      "Malahide", "Leixlip", "Carrigaline", "Tullamore", "Maynooth"
    ]
  },

  no: {
    name: "Norway",
    locale: "no-NO",
    cities: [
      "Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen",
      "Fredrikstad", "Kristiansand", "Sandnes", "Tromsø", "Sarpsborg",
      "Skien", "Ålesund", "Sandefjord", "Haugesund", "Tønsberg",
      "Moss", "Porsgrunn", "Bodø", "Arendal", "Hamar",
      "Larvik", "Halden", "Lillehammer", "Molde", "Kongsberg",
      "Horten", "Gjøvik", "Harstad", "Mo i Rana", "Kristiansund"
    ]
  },

  nz: {
    name: "New Zealand",
    locale: "en-NZ",
    cities: [
      "Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga",
      "Napier-Hastings", "Dunedin", "Palmerston North", "Nelson", "Rotorua",
      "New Plymouth", "Whangarei", "Invercargill", "Whanganui", "Gisborne",
      "Blenheim", "Pukekohe", "Timaru", "Taupo", "Masterton",
      "Levin", "Ashburton", "Cambridge", "Queenstown", "Kapiti",
      "Porirua", "Upper Hutt", "Lower Hutt", "Paraparaumu", "Rangiora"
    ]
  },

  sg: {
    name: "Singapore",
    locale: "en-SG",
    cities: [
      "Singapore", "Jurong West", "Woodlands", "Tampines", "Bedok",
      "Hougang", "Yishun", "Punggol", "Sengkang", "Ang Mo Kio",
      "Bukit Batok", "Bukit Merah", "Toa Payoh", "Queenstown", "Pasir Ris",
      "Clementi", "Choa Chu Kang", "Serangoon", "Bishan", "Geylang",
      "Kallang", "Jurong East", "Bukit Panjang", "Marine Parade", "Novena",
      "Tanglin", "Sembawang", "Bukit Timah", "Outram", "Rochor"
    ]
  },

  // TIER 4 - 15 CITIES
  dk: {
    name: "Denmark",
    locale: "da-DK",
    cities: [
      "Copenhagen", "Aarhus", "Odense", "Aalborg", "Frederiksberg",
      "Esbjerg", "Randers", "Kolding", "Horsens", "Vejle",
      "Roskilde", "Herning", "Silkeborg", "Næstved", "Fredericia"
    ]
  },

  fi: {
    name: "Finland",
    locale: "fi-FI",
    cities: [
      "Helsinki", "Espoo", "Tampere", "Vantaa", "Oulu",
      "Turku", "Jyväskylä", "Lahti", "Kuopio", "Pori",
      "Kouvola", "Joensuu", "Lappeenranta", "Hämeenlinna", "Vaasa"
    ]
  },

  fo: {
    name: "Faroe Islands",
    locale: "fo-FO",
    cities: [
      "Tórshavn", "Klaksvík", "Runavík", "Tvøroyri", "Fuglafjørður",
      "Vestmanna", "Miðvágur", "Sørvágur", "Vágur", "Sandavágur",
      "Kollafjørður", "Eiði", "Saltangará", "Skáli", "Strendur"
    ]
  },

  is: {
    name: "Iceland",
    locale: "is-IS",
    cities: [
      "Reykjavik", "Kópavogur", "Hafnarfjörður", "Akureyri", "Reykjanesbær",
      "Garðabær", "Mosfellsbær", "Akranes", "Selfoss", "Seltjarnarnes",
      "Vestmannaeyjar", "Ísafjörður", "Grindavík", "Húsavík", "Egilsstaðir"
    ]
  },

  ee: {
    name: "Estonia",
    locale: "et-EE",
    cities: [
      "Tallinn", "Tartu", "Narva", "Pärnu", "Kohtla-Järve",
      "Viljandi", "Rakvere", "Maardu", "Sillamäe", "Kuressaare",
      "Valga", "Võru", "Jõhvi", "Haapsalu", "Keila"
    ]
  },

  lv: {
    name: "Latvia",
    locale: "lv-LV",
    cities: [
      "Riga", "Daugavpils", "Liepāja", "Jelgava", "Jūrmala",
      "Ventspils", "Rēzekne", "Valmiera", "Jēkabpils", "Ogre",
      "Tukums", "Cēsis", "Salaspils", "Kuldīga", "Olaine"
    ]
  },

  lt: {
    name: "Lithuania",
    locale: "lt-LT",
    cities: [
      "Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys",
      "Alytus", "Marijampolė", "Mažeikiai", "Jonava", "Utena",
      "Kėdainiai", "Telšiai", "Visaginas", "Tauragė", "Ukmergė"
    ]
  },

  cy: {
    name: "Cyprus",
    locale: "el-CY",
    cities: [
      "Nicosia", "Limassol", "Larnaca", "Famagusta", "Paphos",
      "Kyrenia", "Protaras", "Paralimni", "Ayia Napa", "Strovolos",
      "Lakatamia", "Latsia", "Aglandjia", "Aradippou", "Dali"
    ]
  },

  lu: {
    name: "Luxembourg",
    locale: "fr-LU",
    cities: [
      "Luxembourg City", "Esch-sur-Alzette", "Differdange", "Dudelange", "Ettelbruck",
      "Diekirch", "Wiltz", "Echternach", "Rumelange", "Grevenmacher",
      "Remich", "Vianden", "Clervaux", "Redange", "Mersch"
    ]
  },

  mt: {
    name: "Malta",
    locale: "en-MT",
    cities: [
      "Valletta", "Birkirkara", "Mosta", "Qormi", "Żabbar",
      "St. Paul's Bay", "Sliema", "Żejtun", "Fgura", "Naxxar",
      "San Ġwann", "Żurrieq", "Rabat", "Attard", "Marsaskala"
    ]
  },

  rs: {
    name: "Serbia",
    locale: "sr-RS",
    cities: [
      "Belgrade", "Novi Sad", "Niš", "Kragujevac", "Subotica",
      "Zrenjanin", "Pančevo", "Čačak", "Kraljevo", "Smederevo",
      "Leskovac", "Užice", "Valjevo", "Vranje", "Šabac"
    ]
  },

  si: {
    name: "Slovenia",
    locale: "sl-SI",
    cities: [
      "Ljubljana", "Maribor", "Celje", "Kranj", "Koper",
      "Velenje", "Novo Mesto", "Ptuj", "Trbovlje", "Kamnik",
      "Jesenice", "Nova Gorica", "Domžale", "Škofja Loka", "Murska Sobota"
    ]
  },

  sk: {
    name: "Slovakia",
    locale: "sk-SK",
    cities: [
      "Bratislava", "Košice", "Prešov", "Žilina", "Nitra",
      "Banská Bystrica", "Trnava", "Martin", "Trenčín", "Poprad",
      "Prievidza", "Zvolen", "Považská Bystrica", "Michalovce", "Nové Zámky"
    ]
  },

  hk: {
    name: "Hong Kong",
    locale: "zh-HK",
    cities: [
      "Hong Kong", "Kowloon", "Tsuen Wan", "Sha Tin", "Tuen Mun",
      "Tai Po", "Yuen Long", "Fanling", "Sheung Shui", "Sai Kung",
      "Tseung Kwan O", "Ma On Shan", "Tin Shui Wai", "Kwai Chung", "Tsing Yi"
    ]
  }
};

// ============================================================================
// LOAD DATA
// ============================================================================

function loadCityData() {
  if (!fs.existsSync(CITIES_FILE)) {
    console.error(`Error: City data file not found at ${CITIES_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(CITIES_FILE, 'utf8'));
  return data;
}

// ============================================================================
// COMMANDS
// ============================================================================

function showStats(data) {
  const countries = Object.keys(data.countries);
  let totalCities = 0;
  let tierCounts = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };

  for (const code of countries) {
    const cityCount = data.countries[code].cities.length;
    totalCities += cityCount;

    const tier = getTierForCountry(code);
    tierCounts[`tier${tier.tier}`] += cityCount;
  }

  console.log('\n=== Zinzino City Data Stats ===\n');
  console.log(`Total countries: ${countries.length}`);
  console.log(`Total cities: ${totalCities}`);
  console.log(`Average cities per country: ${(totalCities / countries.length).toFixed(1)}`);
  console.log(`Generated: ${data._meta?.generated || 'unknown'}`);
  console.log('');

  console.log('By Tier:');
  console.log(`  Tier 1 (100 cities): ${TIERS.tier1.length} countries, ${tierCounts.tier1} cities`);
  console.log(`  Tier 2 (50 cities):  ${TIERS.tier2.length} countries, ${tierCounts.tier2} cities`);
  console.log(`  Tier 3 (30 cities):  ${TIERS.tier3.length} countries, ${tierCounts.tier3} cities`);
  console.log(`  Tier 4 (15 cities):  ${TIERS.tier4.length} countries, ${tierCounts.tier4} cities`);
  console.log('');

  // Group by region
  const regions = {
    'Europe (Nordics)': ['dk', 'fo', 'fi', 'is', 'no', 'se'],
    'Europe (Central)': ['at', 'de', 'ch'],
    'Europe (East)': ['cz', 'hu', 'pl', 'ro', 'sk'],
    'Europe (South & West)': ['be', 'cy', 'fr', 'gr', 'ie', 'it', 'lu', 'mt', 'nl', 'rs', 'si', 'es', 'tr', 'gb'],
    'Europe (Baltics)': ['ee', 'lv', 'lt'],
    'Americas (North)': ['ca', 'mx', 'us'],
    'Americas (South)': ['co', 'pe'],
    'Asia-Pacific': ['au', 'cn', 'hk', 'in', 'my', 'nz', 'ph', 'sg', 'kr', 'tw', 'th'],
    'Africa': ['za']
  };

  console.log('By Region:');
  for (const [region, codes] of Object.entries(regions)) {
    const regionCountries = codes.filter(c => data.countries[c]);
    const regionCities = regionCountries.reduce((sum, c) => sum + data.countries[c].cities.length, 0);
    console.log(`  ${region}: ${regionCountries.length} countries, ${regionCities} cities`);
  }
  console.log('');
}

function listCountries(data) {
  console.log('\n=== Zinzino Countries ===\n');
  console.log('Code  | Tier | Cities | Name');
  console.log('------|------|--------|------------------------');

  const codes = Object.keys(data.countries).sort();
  for (const code of codes) {
    const country = data.countries[code];
    const tier = getTierForCountry(code);
    const name = country.name.padEnd(24);
    console.log(`${code.padEnd(5)} | T${tier.tier}   | ${String(country.cities.length).padStart(6)} | ${name}`);
  }
  console.log('');
}

function showCountry(data, countryCode) {
  const code = countryCode.toLowerCase();
  const country = data.countries[code];

  if (!country) {
    console.error(`Error: Country code '${code}' not found`);
    console.log('Use --list to see available country codes');
    process.exit(1);
  }

  const tier = getTierForCountry(code);
  console.log(`\n=== ${country.name} (${code.toUpperCase()}) ===\n`);
  console.log(`Locale: ${country.locale}`);
  console.log(`Tier: ${tier.tier} (${tier.cities} cities target)`);
  console.log(`URL: https://www.zinzino.com/shop/site/us/en-US/Shopping/PartnerSearch`);
  console.log(`\nCities (${country.cities.length}):`);

  country.cities.forEach((city, i) => {
    console.log(`  ${(i + 1).toString().padStart(3)}. ${city}`);
  });
  console.log('');
}

function validateData(data) {
  console.log('\n=== Validating City Data ===\n');

  let errors = 0;
  let warnings = 0;

  // Check required fields
  if (!data._meta) {
    console.error('ERROR: Missing _meta section');
    errors++;
  }

  if (!data.countries) {
    console.error('ERROR: Missing countries section');
    errors++;
    return;
  }

  const codes = Object.keys(data.countries);

  for (const code of codes) {
    const country = data.countries[code];
    const tier = getTierForCountry(code);

    // Check required fields
    if (!country.name) {
      console.error(`ERROR: ${code} - Missing name`);
      errors++;
    }

    if (!country.locale) {
      console.error(`ERROR: ${code} - Missing locale`);
      errors++;
    }

    if (!country.cities || !Array.isArray(country.cities)) {
      console.error(`ERROR: ${code} - Missing or invalid cities array`);
      errors++;
      continue;
    }

    // Check city count matches tier
    if (country.cities.length !== tier.cities) {
      console.warn(`WARNING: ${code} (${country.name}) - Has ${country.cities.length} cities, expected ${tier.cities} for Tier ${tier.tier}`);
      warnings++;
    }

    // Check for duplicates
    const unique = new Set(country.cities.map(c => c.toLowerCase()));
    if (unique.size !== country.cities.length) {
      console.warn(`WARNING: ${code} (${country.name}) - Duplicate cities detected`);
      warnings++;
    }

    // Check for empty strings
    if (country.cities.some(c => !c || c.trim() === '')) {
      console.error(`ERROR: ${code} (${country.name}) - Empty city names`);
      errors++;
    }
  }

  // Summary
  console.log('');
  if (errors === 0 && warnings === 0) {
    console.log('Validation PASSED - No issues found');
  } else {
    console.log(`Validation complete: ${errors} errors, ${warnings} warnings`);
  }
  console.log('');

  return errors === 0;
}

function generateCityData() {
  console.log('\n=== Generating City Data ===\n');

  const output = {
    _meta: {
      description: "Tiered city data for Zinzino Partner Search (Tier 1: 100, Tier 2: 50, Tier 3: 30, Tier 4: 15 cities)",
      countries: Object.keys(EXPANDED_CITY_DATA).length,
      generated: new Date().toISOString().split('T')[0],
      source: "World population data with tiered approach based on market size",
      tiers: {
        tier1: "US, Germany, UK (100 cities each)",
        tier2: "Large population countries (50 cities each)",
        tier3: "Medium markets (30 cities each)",
        tier4: "Smaller countries (15 cities each)"
      }
    },
    countries: {}
  };

  let totalCities = 0;

  for (const [code, data] of Object.entries(EXPANDED_CITY_DATA)) {
    output.countries[code] = data;
    totalCities += data.cities.length;
    console.log(`  ${code.toUpperCase()}: ${data.name} - ${data.cities.length} cities`);
  }

  // Ensure data directory exists
  const dataDir = path.dirname(CITIES_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(CITIES_FILE, JSON.stringify(output, null, 2));

  console.log('');
  console.log(`Generated ${Object.keys(output.countries).length} countries with ${totalCities} total cities`);
  console.log(`Saved to: ${CITIES_FILE}`);
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  const listFlag = args.includes('--list');
  const validateFlag = args.includes('--validate');
  const generateFlag = args.includes('--generate');

  // Parse --country=XX
  let countryCode = null;
  const countryArg = args.find(a => a.startsWith('--country='));
  if (countryArg) {
    countryCode = countryArg.split('=')[1];
  }

  // Generate command doesn't need existing data
  if (generateFlag) {
    generateCityData();
    return;
  }

  const data = loadCityData();

  if (validateFlag) {
    validateData(data);
  } else if (listFlag) {
    listCountries(data);
  } else if (countryCode) {
    showCountry(data, countryCode);
  } else {
    showStats(data);
    console.log('Commands:');
    console.log('  --list              List all countries with their codes and tiers');
    console.log('  --country=XX        Show cities for a specific country');
    console.log('  --validate          Validate data integrity');
    console.log('  --generate          Regenerate cities JSON with tiered data');
    console.log('');
  }
}

main();
