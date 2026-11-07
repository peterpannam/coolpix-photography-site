// Official regions of each state and territory, as lists of ABS LGA 2022 council names.
// Each entry: regionId: [display name, [LGA names]], or null for the catch-all region that takes every council not
// listed elsewhere in that state (the capital-city regions).
//
// Sources (checked 4 Nov 2026):
//  WA  Regional Development Commissions Act 1993, Schedule 1 (Wiluna moved to Goldfields–Esperance in 2021);
//      Perth = the remaining metropolitan LGAs
//  VIC Regional Development Victoria regions (Victorian Government LGA lists); Greater Melbourne = remaining LGAs
//  NSW Environmental Planning and Assessment (Regions) Order 2020; Greater Sydney = the remaining 33 LGAs
//  SA  The 12 South Australian Government Regions. Port Adelaide Enfield is split between Northern and Western
//      Adelaide by a line no council boundary follows, and the unincorporated outback is split between Eyre Western
//      and Far North by the official written description; see build-regions.mjs and build-journey.mjs
//  NT  NT Government regions (Big Rivers = Katherine, Victoria Daly, Roper Gulf)
//  QLD Trade and Investment Queensland's seven regions (Far North Queensland = 25 LGAs, including the Gulf shires);
//      Palm Island (North Queensland) and Cherbourg (Wide Bay–Burnett) are placed by geography, not by a list
//  TAS Land Use Planning and Approvals Act 1993 planning regions (Cradle Coast, Northern, Southern Tasmania)
export const REGIONS = {
  WA: {
    'kimberley': ['Kimberley', ['Broome', 'Derby-West Kimberley', 'Halls Creek', 'Wyndham-East Kimberley']],
    'pilbara': ['Pilbara', ['Ashburton', 'East Pilbara', 'Karratha', 'Port Hedland']],
    'gascoyne': ['Gascoyne', ['Carnarvon', 'Exmouth', 'Shark Bay', 'Upper Gascoyne']],
    'mid-west': ['Mid West', ['Carnamah', 'Chapman Valley', 'Coorow', 'Cue', 'Greater Geraldton', 'Irwin', 'Meekatharra', 'Mingenew', 'Morawa', 'Mount Magnet', 'Murchison', 'Northampton', 'Perenjori', 'Sandstone', 'Three Springs', 'Yalgoo']],
    'wheatbelt': ['Wheatbelt', ['Beverley', 'Brookton', 'Bruce Rock', 'Chittering', 'Corrigin', 'Cuballing', 'Cunderdin', 'Dalwallinu', 'Dandaragan', 'Dowerin', 'Dumbleyung', 'Gingin', 'Goomalling', 'Kellerberrin', 'Kondinin', 'Koorda', 'Kulin', 'Lake Grace', 'Merredin', 'Moora', 'Mount Marshall', 'Mukinbudin', 'Narembeen', 'Narrogin', 'Northam', 'Nungarin', 'Pingelly', 'Quairading', 'Tammin', 'Toodyay', 'Trayning', 'Victoria Plains', 'Wagin', 'Wandering', 'West Arthur', 'Westonia', 'Wickepin', 'Williams', 'Wongan-Ballidu', 'Wyalkatchem', 'Yilgarn', 'York']],
    'perth': ['Perth', null],
    'peel': ['Peel', ['Boddington', 'Mandurah', 'Murray', 'Serpentine-Jarrahdale', 'Waroona']],
    'south-west': ['South West', ['Augusta Margaret River', 'Boyup Brook', 'Bridgetown-Greenbushes', 'Bunbury', 'Busselton', 'Capel', 'Collie', 'Dardanup', 'Donnybrook-Balingup', 'Harvey', 'Manjimup', 'Nannup']],
    'great-southern': ['Great Southern', ['Albany', 'Broomehill-Tambellup', 'Cranbrook', 'Denmark', 'Gnowangerup', 'Jerramungup', 'Katanning', 'Kent', 'Kojonup', 'Plantagenet', 'Woodanilling']],
    'goldfields-esperance': ['Goldfields–Esperance', ['Coolgardie', 'Dundas', 'Esperance', 'Kalgoorlie-Boulder', 'Laverton', 'Leonora', 'Menzies', 'Ngaanyatjarraku', 'Ravensthorpe', 'Wiluna']]
  },
  VIC: {
    'greater-melbourne': ['Greater Melbourne', null],
    'barwon-south-west': ['Barwon South West', ['Colac Otway', 'Corangamite', 'Glenelg', 'Greater Geelong', 'Moyne', 'Queenscliffe', 'Southern Grampians', 'Surf Coast', 'Warrnambool']],
    'gippsland': ['Gippsland', ['Bass Coast', 'Baw Baw', 'East Gippsland', 'Latrobe (Vic.)', 'South Gippsland', 'Wellington']],
    'grampians': ['Grampians', ['Ararat', 'Ballarat', 'Golden Plains', 'Hepburn', 'Hindmarsh', 'Horsham', 'Moorabool', 'Northern Grampians', 'Pyrenees', 'West Wimmera', 'Yarriambiack']],
    'hume': ['Hume', ['Alpine', 'Benalla', 'Greater Shepparton', 'Indigo', 'Mansfield', 'Mitchell', 'Moira', 'Murrindindi', 'Strathbogie', 'Towong', 'Wangaratta', 'Wodonga']],
    'loddon-mallee': ['Loddon Mallee', ['Buloke', 'Campaspe', 'Central Goldfields', 'Gannawarra', 'Greater Bendigo', 'Loddon', 'Macedon Ranges', 'Mildura', 'Mount Alexander', 'Swan Hill']]
  },
  NSW: {
    'greater-sydney': ['Greater Sydney', null],
    'central-coast': ['Central Coast', ['Central Coast (NSW)']],
    'central-west-orana': ['Central West and Orana', ['Bathurst', 'Blayney', 'Bogan', 'Cabonne', 'Coonamble', 'Cowra', 'Dubbo', 'Forbes', 'Gilgandra', 'Lachlan', 'Lithgow', 'Mid-Western', 'Narromine', 'Oberon', 'Orange', 'Parkes', 'Warren', 'Warrumbungle', 'Weddin']],
    'far-west': ['Far West', ['Balranald', 'Bourke', 'Brewarrina', 'Broken Hill', 'Central Darling', 'Cobar', 'Unincorporated NSW', 'Walgett', 'Wentworth']],
    'hunter': ['Hunter', ['Cessnock', 'Dungog', 'Lake Macquarie', 'Maitland', 'Mid-Coast', 'Muswellbrook', 'Newcastle', 'Port Stephens', 'Singleton', 'Upper Hunter']],
    'illawarra-shoalhaven': ['Illawarra-Shoalhaven', ['Kiama', 'Shellharbour', 'Shoalhaven', 'Wollongong']],
    'new-england-north-west': ['New England North West', ['Armidale', 'Glen Innes Severn', 'Gunnedah', 'Gwydir', 'Inverell', 'Liverpool Plains', 'Moree Plains', 'Narrabri', 'Tamworth', 'Tenterfield', 'Uralla', 'Walcha']],
    'north-coast': ['North Coast', ['Ballina', 'Bellingen', 'Byron', 'Clarence Valley', 'Coffs Harbour', 'Kempsey', 'Kyogle', 'Lismore', 'Nambucca Valley', 'Port Macquarie-Hastings', 'Richmond Valley', 'Tweed']],
    'riverina-murray': ['Riverina Murray', ['Albury', 'Berrigan', 'Bland', 'Carrathool', 'Coolamon', 'Cootamundra-Gundagai', 'Edward River', 'Federation', 'Greater Hume', 'Griffith', 'Hay', 'Junee', 'Leeton', 'Lockhart', 'Murray River', 'Murrumbidgee', 'Narrandera', 'Snowy Valleys', 'Temora', 'Wagga Wagga']],
    'south-east-tablelands': ['South East and Tablelands', ['Bega Valley', 'Eurobodalla', 'Goulburn Mulwaree', 'Hilltops', 'Queanbeyan-Palerang', 'Snowy Monaro', 'Upper Lachlan', 'Wingecarribee', 'Yass Valley']]
  },
  SA: {
    'adelaide-hills': ['Adelaide Hills', ['Adelaide Hills', 'Mount Barker']],
    'barossa-light-lower-north': ['Barossa, Light and Lower North', ['Gawler', 'Adelaide Plains', 'Barossa', 'Light']],
    'eastern-adelaide': ['Eastern Adelaide', ['Adelaide', 'Burnside', 'Campbelltown (SA)', 'Norwood Payneham and St Peters', 'Prospect', 'Unley', 'Walkerville']],
    'eyre-western': ['Eyre Western', ['Ceduna', 'Cleve', 'Elliston', 'Franklin Harbour', 'Kimba', 'Lower Eyre Peninsula', 'Port Lincoln', 'Streaky Bay', 'Tumby Bay', 'Wudinna', 'Whyalla', 'Maralinga Tjarutja']],
    'far-north-sa': ['Far North', ['Port Augusta', 'Flinders Ranges', 'Coober Pedy', 'Roxby Downs', 'Anangu Pitjantjatjara Yunkunytjatjara']],
    'fleurieu-kangaroo-island': ['Fleurieu and Kangaroo Island', ['Alexandrina', 'Victor Harbor', 'Kangaroo Island', 'Yankalilla']],
    'limestone-coast': ['Limestone Coast', ['Mount Gambier', 'Grant', 'Kingston (SA)', 'Robe', 'Tatiara', 'Naracoorte Lucindale', 'Wattle Range']],
    'murray-mallee': ['Murray and Mallee', ['Berri Barmera', 'Coorong', 'Karoonda East Murray', 'Loxton Waikerie', 'Mid Murray', 'Southern Mallee', 'Renmark Paringa', 'Murray Bridge']],
    'northern-adelaide': ['Northern Adelaide', ['Playford', 'Salisbury', 'Tea Tree Gully']],
    'southern-adelaide': ['Southern Adelaide', ['Holdfast Bay', 'Marion', 'Mitcham', 'Onkaparinga']],
    'western-adelaide': ['Western Adelaide', ['Charles Sturt', 'West Torrens']],
    'yorke-mid-north': ['Yorke and Mid North', ['Clare and Gilbert Valleys', 'Goyder', 'Mount Remarkable', 'Northern Areas', 'Orroroo Carrieton', 'Peterborough', 'Port Pirie', 'Wakefield', 'Barunga West', 'Copper Coast', 'Yorke Peninsula']]
  },
  NT: {
    'greater-darwin': ['Greater Darwin', ['Darwin', 'Darwin Waterfront Precinct', 'Palmerston', 'Litchfield']],
    'top-end': ['Top End', ['Belyuen', 'Coomalie', 'Tiwi Islands', 'Wagait', 'West Arnhem', 'West Daly']],
    'east-arnhem': ['East Arnhem', ['East Arnhem']],
    'big-rivers': ['Big Rivers', ['Katherine', 'Victoria Daly', 'Roper Gulf']],
    'barkly': ['Barkly', ['Barkly']],
    'central-australia': ['Central Australia', ['Alice Springs', 'Central Desert', 'MacDonnell']]
  },
  QLD: {
    'far-north-queensland': ['Far North Queensland', ['Aurukun', 'Burke', 'Cairns', 'Carpentaria', 'Cassowary Coast', 'Cook', 'Croydon', 'Doomadgee', 'Douglas', 'Etheridge', 'Hope Vale', 'Kowanyama', 'Lockhart River', 'Mapoon', 'Mareeba', 'Mornington', 'Napranum', 'Northern Peninsula Area', 'Pormpuraaw', 'Tablelands', 'Torres', 'Torres Strait Island', 'Weipa', 'Wujal Wujal', 'Yarrabah']],
    'north-queensland': ['North Queensland', ['Burdekin', 'Charters Towers', 'Cloncurry', 'Flinders (Qld)', 'Hinchinbrook', 'McKinlay', 'Mount Isa', 'Palm Island', 'Richmond', 'Townsville']],
    'mackay-isaac-whitsunday': ['Mackay, Isaac and Whitsunday', ['Mackay', 'Isaac', 'Whitsunday']],
    'central-queensland': ['Central Queensland', ['Banana', 'Central Highlands (Qld)', 'Gladstone', 'Livingstone', 'Rockhampton', 'Woorabinda', 'Barcaldine', 'Barcoo', 'Blackall Tambo', 'Boulia', 'Diamantina', 'Longreach', 'Winton']],
    'darling-downs': ['Darling Downs', ['Toowoomba', 'Goondiwindi', 'Southern Downs', 'Western Downs', 'Maranoa', 'Balonne', 'Bulloo', 'Murweh', 'Paroo', 'Quilpie']],
    'wide-bay-burnett': ['Wide Bay–Burnett', ['Bundaberg', 'Cherbourg', 'Fraser Coast', 'Gympie', 'North Burnett', 'South Burnett']],
    'south-east-queensland': ['South East Queensland', ['Brisbane', 'Gold Coast', 'Ipswich', 'Lockyer Valley', 'Logan', 'Moreton Bay', 'Noosa', 'Redland', 'Scenic Rim', 'Somerset', 'Sunshine Coast']]
  },
  TAS: {
    'tas-north-west': ['Cradle Coast', ['Burnie', 'Central Coast (Tas.)', 'Circular Head', 'Devonport', 'Kentish', 'King Island', 'Latrobe (Tas.)', 'Waratah-Wynyard', 'West Coast']],
    'tas-north': ['Northern Tasmania', ['Break O\'Day', 'Dorset', 'Flinders (Tas.)', 'George Town', 'Launceston', 'Meander Valley', 'Northern Midlands', 'West Tamar']],
    'tas-south': ['Southern Tasmania', ['Brighton', 'Central Highlands (Tas.)', 'Clarence', 'Derwent Valley', 'Glamorgan-Spring Bay', 'Glenorchy', 'Hobart', 'Huon Valley', 'Kingborough', 'Sorell', 'Southern Midlands', 'Tasman']]
  },
  ACT: { 'act': ['Australian Capital Territory', null] }
};
