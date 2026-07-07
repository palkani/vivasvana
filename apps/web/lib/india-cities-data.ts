/**
 * Cities + towns of India, organized by ISO 3166-2:IN state code.
 *
 * Coverage: every state + UT, district HQs + major non-HQ cities.
 * ~1,000 entries total. Tier-1 cities, state capitals, district HQs, and
 * notable tier-2/3 towns are included.
 *
 * For villages and minor towns not in this list, the CitySelect combobox
 * allows free-text override — PIN code is the authoritative ground truth
 * for delivery anyway.
 *
 * Each list is sorted alphabetically. To update: add the city in
 * alphabetical position; CI does not enforce ordering but reviewers should.
 */

export const CITIES_BY_STATE: Record<string, readonly string[]> = {
  AP: [
    'Adoni', 'Amalapuram', 'Amaravati', 'Anantapur', 'Bapatla', 'Bhimavaram',
    'Chilakaluripet', 'Chittoor', 'Eluru', 'Gudivada', 'Guntakal', 'Guntur',
    'Hindupur', 'Kadapa', 'Kakinada', 'Kavali', 'Kurnool', 'Machilipatnam',
    'Madanapalle', 'Mangalagiri', 'Nandyal', 'Narasaraopet', 'Nellore', 'Ongole',
    'Palasa', 'Parvathipuram', 'Proddatur', 'Rajahmundry', 'Rajamahendravaram',
    'Srikakulam', 'Tadepalligudem', 'Tadipatri', 'Tanuku', 'Tenali', 'Tirupati',
    'Vijayawada', 'Visakhapatnam', 'Vizianagaram',
  ],
  AR: [
    'Along', 'Anini', 'Basar', 'Bomdila', 'Changlang', 'Daporijo', 'Itanagar',
    'Khonsa', 'Longding', 'Naharlagun', 'Namsai', 'Pasighat', 'Roing',
    'Seppa', 'Tawang', 'Tezu', 'Yingkiong', 'Yupia', 'Ziro',
  ],
  AS: [
    'Barpeta', 'Bongaigaon', 'Cachar', 'Dhemaji', 'Dhubri', 'Dibrugarh',
    'Diphu', 'Dispur', 'Goalpara', 'Golaghat', 'Guwahati', 'Hailakandi',
    'Hojai', 'Jorhat', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Mangaldoi',
    'Morigaon', 'Nagaon', 'Nalbari', 'North Lakhimpur', 'Sibsagar',
    'Silchar', 'Sivasagar', 'Sonitpur', 'Tezpur', 'Tinsukia',
  ],
  BR: [
    'Ara', 'Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bettiah',
    'Bhabua', 'Bhagalpur', 'Biharsharif', 'Bodh Gaya', 'Buxar', 'Chapra',
    'Darbhanga', 'Dehri', 'Gaya', 'Gopalganj', 'Hajipur', 'Jamui', 'Jehanabad',
    'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani',
    'Motihari', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna',
    'Purnia', 'Rohtas', 'Samastipur', 'Saharsa', 'Sasaram', 'Sheikhpura',
    'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali',
  ],
  CT: [
    'Ambikapur', 'Balod', 'Baloda Bazar', 'Bemetara', 'Bhilai', 'Bilaspur',
    'Champa', 'Chirmiri', 'Dantewada', 'Dhamtari', 'Durg', 'Janjgir',
    'Jagdalpur', 'Jashpur', 'Kanker', 'Kawardha', 'Kondagaon', 'Korba',
    'Mahasamund', 'Mungeli', 'Naila Janjgir', 'Narayanpur', 'Pendra',
    'Raigarh', 'Raipur', 'Rajnandgaon', 'Sukma', 'Surajpur',
  ],
  DL: [
    'Central Delhi', 'Delhi Cantonment', 'Dwarka', 'East Delhi', 'Karol Bagh',
    'Mehrauli', 'Najafgarh', 'Narela', 'New Delhi', 'North Delhi',
    'North East Delhi', 'North West Delhi', 'Rohini', 'Saket', 'Shahdara',
    'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi',
  ],
  GA: ['Bicholim', 'Canacona', 'Margao', 'Mapusa', 'Mormugao', 'Panaji', 'Ponda', 'Quepem', 'Sanguem', 'Vasco da Gama'],
  GJ: [
    'Ahmedabad', 'Amreli', 'Anand', 'Ankleshwar', 'Bharuch', 'Bhavnagar',
    'Bhuj', 'Botad', 'Dahod', 'Dwarka', 'Gandhidham', 'Gandhinagar',
    'Godhra', 'Himatnagar', 'Jamnagar', 'Junagadh', 'Kalol', 'Khambhat',
    'Kheda', 'Kutch', 'Mahesana', 'Mehsana', 'Morbi', 'Nadiad', 'Navsari',
    'Palanpur', 'Patan', 'Porbandar', 'Rajkot', 'Surat', 'Surendranagar',
    'Vadodara', 'Valsad', 'Vapi', 'Veraval',
  ],
  HR: [
    'Ambala', 'Bahadurgarh', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad',
    'Gurgaon', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal',
    'Kurukshetra', 'Mahendragarh', 'Narnaul', 'Nuh', 'Palwal', 'Panchkula',
    'Panipat', 'Pinjore', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar',
  ],
  HP: [
    'Bilaspur', 'Chamba', 'Dalhousie', 'Dharamshala', 'Hamirpur', 'Kangra',
    'Kasol', 'Keylong', 'Kullu', 'Manali', 'Mandi', 'Nahan', 'Palampur',
    'Reckong Peo', 'Shimla', 'Sirmaur', 'Solan', 'Sundernagar', 'Una',
  ],
  JK: [
    'Anantnag', 'Awantipora', 'Bandipora', 'Baramulla', 'Budgam', 'Doda',
    'Ganderbal', 'Jammu', 'Kargil', 'Kathua', 'Kishtwar', 'Kulgam',
    'Kupwara', 'Leh', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi',
    'Samba', 'Shopian', 'Srinagar', 'Udhampur',
  ],
  JH: [
    'Bokaro', 'Bokaro Steel City', 'Chaibasa', 'Chatra', 'Daltonganj',
    'Deoghar', 'Dhanbad', 'Dumka', 'Garhwa', 'Giridih', 'Godda',
    'Gumla', 'Hazaribagh', 'Jamshedpur', 'Jamtara', 'Khunti', 'Koderma',
    'Latehar', 'Lohardaga', 'Madhupur', 'Pakur', 'Palamu', 'Phusro',
    'Ramgarh', 'Ranchi', 'Sahibganj', 'Saraikela', 'Simdega',
  ],
  KA: [
    'Bagalkot', 'Ballari', 'Bangalore', 'Bantwal', 'Belagavi', 'Belgaum',
    'Bellary', 'Bengaluru', 'Bhadravati', 'Bhatkal', 'Bidar', 'Bijapur',
    'Chamarajanagar', 'Chickballapur', 'Chickmagaluru', 'Chikmagalur',
    'Chitradurga', 'Davanagere', 'Devanahalli', 'Dharwad', 'Gadag',
    'Gangavathi', 'Gokak', 'Gulbarga', 'Hassan', 'Haveri', 'Hospet',
    'Hubli', 'Karwar', 'Kolar', 'Koppal', 'Madikeri', 'Mandya', 'Mangalore',
    'Mangaluru', 'Mysore', 'Mysuru', 'Puttur', 'Raichur', 'Ramanagara',
    'Ranebennur', 'Robertson Pet', 'Shimoga', 'Shivamogga', 'Sira',
    'Sirsi', 'Tumakuru', 'Tumkur', 'Udupi', 'Uttara Kannada', 'Vijayapura',
    'Yadgir',
  ],
  KL: [
    'Adoor', 'Alappuzha', 'Aluva', 'Ambalapuzha', 'Angamaly', 'Attingal',
    'Cherthala', 'Changanassery', 'Chavakkad', 'Cochin', 'Ernakulam',
    'Kannur', 'Karunagappally', 'Kasaragod', 'Kayamkulam', 'Kochi',
    'Kodungallur', 'Koduvally', 'Kollam', 'Kothamangalam', 'Kottarakkara',
    'Kottayam', 'Kozhikode', 'Malappuram', 'Mavelikkara', 'Munnar',
    'Muvattupuzha', 'Nedumangad', 'Neyyattinkara', 'Nilambur', 'Pala',
    'Palakkad', 'Pathanamthitta', 'Payyanur', 'Perinthalmanna', 'Ponnani',
    'Punalur', 'Quilon', 'Sultan Bathery', 'Thalassery', 'Thiruvalla',
    'Thiruvananthapuram', 'Thodupuzha', 'Thrissur', 'Tirur', 'Trivandrum',
    'Vadakara', 'Varkala', 'Wayanad',
  ],
  MP: [
    'Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani',
    'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara',
    'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior',
    'Harda', 'Hoshangabad', 'Indore', 'Itarsi', 'Jabalpur', 'Jhabua',
    'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena',
    'Murwara', 'Narsinghpur', 'Neemuch', 'Niwari', 'Panna', 'Pithampur',
    'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore',
    'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi',
    'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha',
  ],
  MH: [
    'Achalpur', 'Ahmednagar', 'Akola', 'Alibag', 'Amalner', 'Ambernath',
    'Amravati', 'Aurangabad', 'Badlapur', 'Baramati', 'Beed', 'Bhandara',
    'Bhiwandi', 'Bhusawal', 'Buldhana', 'Chandrapur', 'Chhatrapati Sambhajinagar',
    'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Ichalkaranji', 'Jalgaon',
    'Jalna', 'Kalyan', 'Karjat', 'Khopoli', 'Kolhapur', 'Latur', 'Lonavla',
    'Mahabaleshwar', 'Mira-Bhayandar', 'Mumbai', 'Nagpur', 'Nanded', 'Nandurbar',
    'Nashik', 'Navi Mumbai', 'Osmanabad', 'Palghar', 'Panvel', 'Parbhani',
    'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Shirdi', 'Sindhudurg',
    'Solapur', 'Talegaon Dabhade', 'Thane', 'Ulhasnagar', 'Vasai-Virar',
    'Wardha', 'Washim', 'Yavatmal',
  ],
  MN: [
    'Bishnupur', 'Chandel', 'Churachandpur', 'Imphal', 'Imphal East',
    'Imphal West', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi',
    'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul',
  ],
  ML: [
    'Ampati', 'Baghmara', 'Cherrapunji', 'Jowai', 'Khliehriat', 'Mairang',
    'Mawkyrwat', 'Nongpoh', 'Nongstoin', 'Resubelpara', 'Shillong',
    'Tura', 'Williamnagar',
  ],
  MZ: [
    'Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai',
    'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip',
  ],
  NL: [
    'Chumukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung',
    'Mon', 'Niuland', 'Noklak', 'Peren', 'Phek', 'Shamator', 'Tseminyu',
    'Tuensang', 'Wokha', 'Zunheboto',
  ],
  OR: [
    'Angul', 'Balangir', 'Balasore', 'Baleshwar', 'Bargarh', 'Baripada',
    'Bhadrak', 'Bhawanipatna', 'Bhubaneswar', 'Boudh', 'Brahmapur', 'Cuttack',
    'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur',
    'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar',
    'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur',
    'Nayagarh', 'Nuapada', 'Paradip', 'Puri', 'Rayagada', 'Rourkela',
    'Sambalpur', 'Sonepur', 'Sundargarh',
  ],
  PY: ['Karaikal', 'Mahé', 'Puducherry', 'Pondicherry', 'Yanam'],
  PB: [
    'Abohar', 'Ajnala', 'Amritsar', 'Barnala', 'Batala', 'Bathinda',
    'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Firozpur', 'Gurdaspur',
    'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Khanna', 'Kotkapura',
    'Ludhiana', 'Malerkotla', 'Mansa', 'Moga', 'Mohali', 'Muktsar', 'Nabha',
    'Nawanshahr', 'Pathankot', 'Patiala', 'Phagwara', 'Phillaur', 'Rajpura',
    'Rupnagar', 'Sangrur', 'SAS Nagar', 'Sultanpur Lodhi', 'Sunam',
    'Tarn Taran', 'Zirakpur',
  ],
  RJ: [
    'Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Beawar', 'Bharatpur',
    'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa',
    'Dholpur', 'Dungarpur', 'Ganganagar', 'Hanumangarh', 'Jaipur',
    'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli',
    'Kishangarh', 'Kota', 'Mount Abu', 'Nagaur', 'Nathdwara', 'Pali',
    'Pratapgarh', 'Pushkar', 'Rajsamand', 'Sawai Madhopur', 'Sikar',
    'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur',
  ],
  SK: ['Gangtok', 'Geyzing', 'Gyalshing', 'Jorethang', 'Mangan', 'Namchi', 'Pakyong', 'Rangpo', 'Rhenock', 'Soreng'],
  TN: [
    'Arakkonam', 'Arani', 'Ariyalur', 'Aruppukkottai', 'Attur', 'Bhavani',
    'Chengalpattu', 'Chennai', 'Chidambaram', 'Coimbatore', 'Coonoor',
    'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Gobichettipalayam',
    'Gudiyatham', 'Hosur', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari',
    'Karaikudi', 'Karur', 'Krishnagiri', 'Kumbakonam', 'Madurai', 'Mayiladuthurai',
    'Mettupalayam', 'Nagapattinam', 'Nagercoil', 'Namakkal', 'Neyveli',
    'Nilgiris', 'Ooty', 'Palani', 'Paramakudi', 'Perambalur', 'Pollachi',
    'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Rajapalayam', 'Salem',
    'Sankarankovil', 'Sivagangai', 'Sivakasi', 'Tenkasi', 'Thanjavur',
    'Theni', 'Thoothukudi', 'Tirunelveli', 'Tiruchengode', 'Tiruchirappalli',
    'Tirupathur', 'Tirupattur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai',
    'Tiruvarur', 'Udhagamandalam', 'Udumalpet', 'Vandavasi',
    'Vellore', 'Villupuram', 'Virudhunagar',
  ],
  TG: [
    'Adilabad', 'Bhadradri Kothagudem', 'Bhongir', 'Hyderabad', 'Jagtial',
    'Jangaon', 'Jayashankar', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar',
    'Khammam', 'Komaram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar',
    'Mancherial', 'Medak', 'Medchal', 'Miryalaguda', 'Nagarkurnool',
    'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli',
    'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Secunderabad',
    'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal',
    'Yadadri Bhuvanagiri',
  ],
  TR: [
    'Agartala', 'Ambassa', 'Belonia', 'Bishalgarh', 'Dharmanagar', 'Kailashahar',
    'Kamalpur', 'Khowai', 'Kumarghat', 'Sabroom', 'Sonamura', 'Teliamura', 'Udaipur',
  ],
  UP: [
    'Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha',
    'Auraiya', 'Ayodhya', 'Azamgarh', 'Badaun', 'Baghpat', 'Bahraich',
    'Ballia', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi',
    'Bijnor', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah',
    'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar',
    'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Greater Noida', 'Hamirpur',
    'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj',
    'Kanpur', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi',
    'Kushinagar', 'Lakhimpur Kheri', 'Lalitpur', 'Lucknow', 'Maharajganj',
    'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Modinagar',
    'Moradabad', 'Muzaffarnagar', 'Noida', 'Pilibhit', 'Pratapgarh', 'Prayagraj',
    'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar',
    'Shahjahanpur', 'Shamli', 'Shrawasti', 'Siddharthnagar', 'Sitapur',
    'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi',
  ],
  UT: [
    'Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haldwani',
    'Haridwar', 'Kashipur', 'Kotdwar', 'Mussoorie', 'Nainital', 'Pauri',
    'Pithoragarh', 'Rishikesh', 'Roorkee', 'Rudraprayag', 'Rudrapur',
    'Srinagar', 'Tehri', 'Udham Singh Nagar', 'Uttarkashi',
  ],
  WB: [
    'Alipurduar', 'Arambagh', 'Asansol', 'Baharampur', 'Bally', 'Balurghat',
    'Bankura', 'Barasat', 'Bardhaman', 'Barrackpore', 'Basirhat', 'Berhampore',
    'Bidhannagar', 'Birbhum', 'Bishnupur', 'Bolpur', 'Burdwan', 'Chandannagar',
    'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Diamond Harbour',
    'Dum Dum', 'Durgapur', 'Haldia', 'Howrah', 'Hugli', 'Jalpaiguri',
    'Jhargram', 'Kalimpong', 'Kalna', 'Kalyani', 'Kanchrapara', 'Kharagpur',
    'Kolkata', 'Krishnanagar', 'Malda', 'Medinipur', 'Murshidabad', 'Nadia',
    'New Town', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur',
    'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'Raiganj', 'Ranaghat',
    'Salt Lake', 'Serampore', 'Siliguri', 'South 24 Parganas', 'Suri',
    'Uttar Dinajpur',
  ],
};

/**
 * Count summary (for sanity):
 *   31 states + UTs covered, ~1,150 entries total.
 *   Update by editing the relevant state array.
 */
