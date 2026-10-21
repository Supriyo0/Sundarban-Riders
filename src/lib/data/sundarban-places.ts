/**
 * Sundarban Riders — Verified Real-World Landmarks & POIs
 * 
 * Contains verified real-world landmarks across South 24 Parganas, Sundarbans, and Kolkata
 * with authentic GPS coordinates (no synthetic grid offsets).
 * All general search queries dynamically query live OpenStreetMap & Google Suggest.
 */

export interface SundarbanPlace {
  name: string;
  category: "station" | "bus_stand" | "toto_stand" | "ferry_ghat" | "bridge" | "hospital" | "school_college" | "market" | "beach" | "hotel" | "restaurant" | "temple" | "admin";
  categoryLabel: string;
  aliases: string[];
  lat: number;
  lng: number;
  subLocality: string;
}

export const SUNDARBAN_COMPREHENSIVE_PLACES: SundarbanPlace[] = [
  // ── BAKKHALI & FRASERGANJ ──
  {
    name: "Bakkhali Sea Beach (Main Beach)",
    category: "beach",
    categoryLabel: "Sea Beach",
    aliases: ["bakkhali beach", "bakkhali sea beach", "bakkhali seabeach", "bakkhali main beach", "bakkhali"],
    lat: 21.5605,
    lng: 88.2574,
    subLocality: "Namkhana, South 24 Parganas"
  },
  {
    name: "Bakkhali Bus Stand",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["bakkhali bus stop", "bakkhali bus terminus"],
    lat: 21.5642,
    lng: 88.2541,
    subLocality: "Namkhana, South 24 Parganas"
  },
  {
    name: "Bakkhali Toto & Auto Rickshaw Stand",
    category: "toto_stand",
    categoryLabel: "Toto Stand",
    aliases: ["bakkhali toto stand", "bakkhali auto stand"],
    lat: 21.5638,
    lng: 88.2548,
    subLocality: "Namkhana, South 24 Parganas"
  },
  {
    name: "Henry Island Watchtower & Beach",
    category: "beach",
    categoryLabel: "Sea Beach",
    aliases: ["henry island", "henrys island", "henry beach", "henry island mangrove"],
    lat: 21.5768,
    lng: 88.2935,
    subLocality: "Fraserganj, South 24 Parganas"
  },
  {
    name: "Fraserganj Windmill Beach",
    category: "beach",
    categoryLabel: "Sea Beach",
    aliases: ["fraserganj beach", "frazerganj beach", "windmill beach", "fraserganj"],
    lat: 21.5895,
    lng: 88.2486,
    subLocality: "Fraserganj, South 24 Parganas"
  },
  {
    name: "Fraserganj Fishing Harbour",
    category: "ferry_ghat",
    categoryLabel: "Jetty Ghat",
    aliases: ["fraserganj harbour", "frazerganj fishing harbour", "fraserganj port"],
    lat: 21.5972,
    lng: 88.2435,
    subLocality: "Fraserganj, South 24 Parganas"
  },
  {
    name: "Fraserganj Coastal Police Station",
    category: "admin",
    categoryLabel: "Police Station",
    aliases: ["fraserganj police station", "frazerganj coastal police"],
    lat: 21.5910,
    lng: 88.2510,
    subLocality: "Fraserganj, South 24 Parganas"
  },

  // ── NAMKHANA ──
  {
    name: "Namkhana Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["namkhana station", "namkhana train station", "namkhana rail"],
    lat: 21.7645,
    lng: 88.2325,
    subLocality: "Namkhana, South 24 Parganas"
  },
  {
    name: "Namkhana Bus Terminus",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["namkhana bus stand", "namkhana bus"],
    lat: 21.7705,
    lng: 88.2384,
    subLocality: "Namkhana, South 24 Parganas"
  },
  {
    name: "Hatania-Doania Bridge (Namkhana Bridge)",
    category: "bridge",
    categoryLabel: "Bridge",
    aliases: ["hatania doania bridge", "namkhana bridge"],
    lat: 21.7745,
    lng: 88.2425,
    subLocality: "Namkhana, South 24 Parganas"
  },
  {
    name: "Namkhana Rural Hospital",
    category: "hospital",
    categoryLabel: "Hospital",
    aliases: ["namkhana hospital", "namkhana health centre"],
    lat: 21.7685,
    lng: 88.2355,
    subLocality: "Namkhana, South 24 Parganas"
  },
  {
    name: "Namkhana BDO & Panchayat Office",
    category: "admin",
    categoryLabel: "Admin Office",
    aliases: ["namkhana bdo", "namkhana panchayat"],
    lat: 21.7695,
    lng: 88.2370,
    subLocality: "Namkhana, South 24 Parganas"
  },
  {
    name: "Narayanpur Bazar & Ferry Ghat",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["narayanpur bazar", "narayanpur ghat", "narayanpur namkhana"],
    lat: 21.7485,
    lng: 88.2215,
    subLocality: "Namkhana, South 24 Parganas"
  },

  // ── KAKDWIP ──
  {
    name: "Kakdwip Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["kakdwip station", "kakdwip train station", "kakdwip"],
    lat: 21.8797,
    lng: 88.1906,
    subLocality: "Kakdwip, South 24 Parganas"
  },
  {
    name: "Kakdwip Central Bus Terminus",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["kakdwip bus stand", "kakdwip bus terminus", "kakdwip bus stop"],
    lat: 21.8745,
    lng: 88.1852,
    subLocality: "Kakdwip, South 24 Parganas"
  },
  {
    name: "Kakdwip Sub-Divisional Hospital",
    category: "hospital",
    categoryLabel: "Hospital",
    aliases: ["kakdwip hospital", "kakdwip sub divisional hospital", "kakdwip sd hospital"],
    lat: 21.8752,
    lng: 88.1868,
    subLocality: "Kakdwip, South 24 Parganas"
  },
  {
    name: "Kakdwip Court & Sub-Divisional Magistrate",
    category: "admin",
    categoryLabel: "Admin Office",
    aliases: ["kakdwip court", "kakdwip sdo office", "kakdwip sdm"],
    lat: 21.8765,
    lng: 88.1840,
    subLocality: "Kakdwip, South 24 Parganas"
  },
  {
    name: "Kakdwip Police Station",
    category: "admin",
    categoryLabel: "Police Station",
    aliases: ["kakdwip police station", "kakdwip thana"],
    lat: 21.8735,
    lng: 88.1830,
    subLocality: "Kakdwip, South 24 Parganas"
  },
  {
    name: "Sundarban Mahavidyalaya College",
    category: "school_college",
    categoryLabel: "School / College",
    aliases: ["sundarban mahavidyalaya", "kakdwip college"],
    lat: 21.8785,
    lng: 88.1870,
    subLocality: "Kakdwip, South 24 Parganas"
  },
  {
    name: "Ganeshpur More Bus Stand",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["ganeshpur more", "ganeshpur bus stand", "ganeshpur"],
    lat: 21.8685,
    lng: 88.1925,
    subLocality: "Kakdwip, South 24 Parganas"
  },
  {
    name: "Harwood Point (Lot 8) Ferry Ghat",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["lot 8", "lot 8 ferry ghat", "lot 8 ghat", "harwood point", "harwood point ghat", "lot eight"],
    lat: 21.8988,
    lng: 88.1485,
    subLocality: "Kakdwip, South 24 Parganas"
  },
  {
    name: "Lot 8 Bus Stand & Vessel Jetty",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["lot 8 bus stand", "lot 8 vessel jetty"],
    lat: 21.8975,
    lng: 88.1495,
    subLocality: "Kakdwip, South 24 Parganas"
  },

  // ── SAGAR ISLAND (GANGASAGAR) ──
  {
    name: "Kachuberia Ferry Ghat",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["kachuberia", "kachuberia ghat", "kachuberia ferry", "kachuberia jetty"],
    lat: 21.8710,
    lng: 88.1345,
    subLocality: "Sagar Island, South 24 Parganas"
  },
  {
    name: "Kachuberia Bus Stand",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["kachuberia bus stand", "kachuberia bus"],
    lat: 21.8702,
    lng: 88.1352,
    subLocality: "Sagar Island, South 24 Parganas"
  },
  {
    name: "Kapil Muni Temple, Gangasagar",
    category: "temple",
    categoryLabel: "Temple / Ashram",
    aliases: ["kapil muni temple", "gangasagar temple", "kapil muni ashram", "kapil muni mandir", "gangasagar mandir"],
    lat: 21.6495,
    lng: 88.0315,
    subLocality: "Gangasagar, Sagar Island"
  },
  {
    name: "Gangasagar Sea Beach (Main Mela Beach)",
    category: "beach",
    categoryLabel: "Sea Beach",
    aliases: ["gangasagar beach", "gangasagar sea beach", "gangasagar mela beach", "gangasagar"],
    lat: 21.6425,
    lng: 88.0285,
    subLocality: "Gangasagar, Sagar Island"
  },
  {
    name: "Gangasagar Bus Stand",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["gangasagar bus stand", "gangasagar bus terminus"],
    lat: 21.6480,
    lng: 88.0330,
    subLocality: "Gangasagar, Sagar Island"
  },
  {
    name: "Rudranagar Market & Bus Stand",
    category: "market",
    categoryLabel: "Bazar / Market",
    aliases: ["rudranagar", "rudranagar bazar", "rudranagar bus stand", "rudranagar market"],
    lat: 21.7225,
    lng: 88.0865,
    subLocality: "Sagar Island, South 24 Parganas"
  },
  {
    name: "Sagar Rural Hospital (Rudranagar)",
    category: "hospital",
    categoryLabel: "Hospital",
    aliases: ["sagar hospital", "rudranagar hospital", "sagar rural hospital"],
    lat: 21.7245,
    lng: 88.0880,
    subLocality: "Sagar Island, South 24 Parganas"
  },
  {
    name: "Chemaguri Ferry Ghat",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["chemaguri", "chemaguri ghat", "chemeguri"],
    lat: 21.6985,
    lng: 88.1625,
    subLocality: "Sagar Island, South 24 Parganas"
  },
  {
    name: "Benubon Ferry Ghat",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["benubon", "benubon ghat", "benuban"],
    lat: 21.6745,
    lng: 88.1785,
    subLocality: "Sagar Island, South 24 Parganas"
  },

  // ── DIAMOND HARBOUR & KULPI ──
  {
    name: "Diamond Harbour Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["diamond harbour station", "diamond harbour train station", "diamond harbour"],
    lat: 22.1895,
    lng: 88.1942,
    subLocality: "Diamond Harbour, South 24 Parganas"
  },
  {
    name: "Diamond Harbour Super Specialty Hospital",
    category: "hospital",
    categoryLabel: "Hospital",
    aliases: ["diamond harbour hospital", "diamond harbour super specialty", "dh hospital"],
    lat: 22.1932,
    lng: 88.1884,
    subLocality: "Diamond Harbour, South 24 Parganas"
  },
  {
    name: "Diamond Harbour Bus Terminus",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["diamond harbour bus stand", "diamond harbour bus"],
    lat: 22.1915,
    lng: 88.1925,
    subLocality: "Diamond Harbour, South 24 Parganas"
  },
  {
    name: "Diamond Harbour Ferry Ghat (Hooghly River)",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["diamond harbour ghat", "diamond harbour ferry ghat"],
    lat: 22.1950,
    lng: 88.1825,
    subLocality: "Diamond Harbour, South 24 Parganas"
  },
  {
    name: "Kulpi Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["kulpi station", "kulpi train station", "kulpi"],
    lat: 22.0835,
    lng: 88.2415,
    subLocality: "Kulpi, South 24 Parganas"
  },
  {
    name: "Karanjali Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["karanjali station", "karanjali"],
    lat: 22.1245,
    lng: 88.2312,
    subLocality: "Kulpi, South 24 Parganas"
  },
  {
    name: "Nischindapur Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["nischindapur station", "nischindapur"],
    lat: 22.0215,
    lng: 88.2545,
    subLocality: "Kulpi, South 24 Parganas"
  },

  // ── LAKSHMIKANTAPUR, MATHURAPUR & PATHARPRATIMA ──
  {
    name: "Lakshmikantapur Railway Junction",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["lakshmikantapur station", "lakshmikantapur junction", "lakshmikantapur"],
    lat: 22.1585,
    lng: 88.3182,
    subLocality: "Lakshmikantapur, South 24 Parganas"
  },
  {
    name: "Mathurapur Road Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["mathurapur road station", "mathurapur station", "mathurapur"],
    lat: 22.1955,
    lng: 88.3512,
    subLocality: "Mathurapur, South 24 Parganas"
  },
  {
    name: "Joynagar Majilpur Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["joynagar station", "majilpur station", "joynagar majilpur"],
    lat: 22.2855,
    lng: 88.4215,
    subLocality: "Joynagar, South 24 Parganas"
  },
  {
    name: "Patharpratima BDO & Ferry Ghat",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["patharpratima", "patharpratima ghat", "patharpratima ferry"],
    lat: 21.7925,
    lng: 88.3515,
    subLocality: "Patharpratima, South 24 Parganas"
  },
  {
    name: "Ramganga Ferry Ghat & Bus Stand",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["ramganga", "ramganga ghat", "ramganga ferry ghat"],
    lat: 21.7585,
    lng: 88.3615,
    subLocality: "Patharpratima, South 24 Parganas"
  },
  {
    name: "Raidighi Bus Terminus & Ferry Ghat",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["raidighi", "raidighi bus stand", "raidighi ferry ghat"],
    lat: 21.9985,
    lng: 88.4385,
    subLocality: "Raidighi, South 24 Parganas"
  },
  {
    name: "G-Plot (Gobardhanpur) Ferry Ghat",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["g plot", "g-plot", "gobardhanpur ghat", "g plot ferry ghat"],
    lat: 21.6125,
    lng: 88.4115,
    subLocality: "Patharpratima, South 24 Parganas"
  },

  // ── CANNING & SUNDARBAN GATEWAYS ──
  {
    name: "Canning Railway Station (Sundarban Gateway)",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["canning station", "canning railway station", "canning"],
    lat: 22.3125,
    lng: 88.6625,
    subLocality: "Canning, South 24 Parganas"
  },
  {
    name: "Canning Sub-Divisional Hospital",
    category: "hospital",
    categoryLabel: "Hospital",
    aliases: ["canning hospital", "canning sd hospital"],
    lat: 22.3150,
    lng: 88.6650,
    subLocality: "Canning, South 24 Parganas"
  },
  {
    name: "Godkhali Ferry Ghat (Launch to Sundarban Core)",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["godkhali", "godkhali ghat", "godkhali ferry ghat", "godkhali launch ghat"],
    lat: 22.1845,
    lng: 88.7985,
    subLocality: "Gosaba, South 24 Parganas"
  },
  {
    name: "Gosaba Ferry Ghat & Bazar",
    category: "ferry_ghat",
    categoryLabel: "Ferry Ghat",
    aliases: ["gosaba", "gosaba ghat", "gosaba ferry ghat", "gosaba bazar"],
    lat: 22.1645,
    lng: 88.8085,
    subLocality: "Gosaba, South 24 Parganas"
  },
  {
    name: "Basanti Bazar & Matla Bridge",
    category: "market",
    categoryLabel: "Bazar / Market",
    aliases: ["basanti", "basanti bazar", "matla bridge"],
    lat: 22.2015,
    lng: 88.7185,
    subLocality: "Basanti, South 24 Parganas"
  },

  // ── TRANSIT & MAJOR HUBS (SOUTH 24 PARGANAS TO KOLKATA) ──
  {
    name: "Amtala More Bus Stand",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["amtala", "amtala more", "amtala bus stand"],
    lat: 22.3785,
    lng: 88.2715,
    subLocality: "Bishnupur, South 24 Parganas"
  },
  {
    name: "Baruipur Railway Junction",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["baruipur station", "baruipur junction", "baruipur"],
    lat: 22.3615,
    lng: 88.4325,
    subLocality: "Baruipur, South 24 Parganas"
  },
  {
    name: "Sonarpur Railway Junction",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["sonarpur station", "sonarpur junction", "sonarpur"],
    lat: 22.4412,
    lng: 88.4285,
    subLocality: "Sonarpur, South 24 Parganas"
  },
  {
    name: "Garia Metro Station (Kavi Nazrul)",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["garia metro", "kavi nazrul metro", "garia"],
    lat: 22.4645,
    lng: 88.3845,
    subLocality: "Garia, Kolkata"
  },
  {
    name: "Science City Kolkata",
    category: "market",
    categoryLabel: "Landmark",
    aliases: ["science city", "science city kolkata", "science city auditorium"],
    lat: 22.5401,
    lng: 88.3958,
    subLocality: "J.B.S. Haldane Avenue, Kolkata"
  },
  {
    name: "Victoria Memorial Kolkata",
    category: "market",
    categoryLabel: "Landmark",
    aliases: ["victoria memorial", "victoria hall", "victoria"],
    lat: 22.5448,
    lng: 88.3426,
    subLocality: "Queens Way, Kolkata"
  },
  {
    name: "Howrah Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["howrah station", "howrah railway station", "howrah junction", "howrah"],
    lat: 22.5835,
    lng: 88.3432,
    subLocality: "Howrah, West Bengal"
  },
  {
    name: "Sealdah Railway Station",
    category: "station",
    categoryLabel: "Railway Station",
    aliases: ["sealdah station", "sealdah railway station", "sealdah"],
    lat: 22.5697,
    lng: 88.3712,
    subLocality: "Sealdah, Kolkata"
  },
  {
    name: "Esplanade Bus Terminus & Metro",
    category: "bus_stand",
    categoryLabel: "Bus Stand",
    aliases: ["esplanade", "esplanade bus terminus", "esplanade metro", "dharmatala"],
    lat: 22.5645,
    lng: 88.3516,
    subLocality: "Esplanade, Kolkata"
  },
  {
    name: "Netaji Subhash Chandra Bose International Airport (CCU)",
    category: "station",
    categoryLabel: "Airport",
    aliases: ["kolkata airport", "dum dum airport", "ccu airport", "airport kolkata"],
    lat: 22.6547,
    lng: 88.4467,
    subLocality: "Dum Dum, Kolkata"
  }
];
