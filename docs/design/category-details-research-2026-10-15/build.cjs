const fs=require('fs'),path=require('path'),ts=require(path.resolve('node_modules/typescript')),vm=require('vm');
const source=fs.readFileSync(path.resolve('src/lib/taxonomy.ts'),'utf8');
const box={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,box);
const taxonomy=box.exports.TAXONOMY;
const sources={
 object:{title:'Getty Object ID documentation principles',url:'https://www.getty.edu/publications/resources/virtuallibrary/0892365722.pdf'},
 comics:{title:'CGC submission identifiers',url:'https://www.cgccomics.com/generic-forms/submission-form/cgc-private-signing/cgc-todd-mcfarlane-private-signing/'},
 cards:{title:'PSA identifying card details',url:'https://www.psacard.com/info/get-started'},
 records:{title:'Discogs labels and catalog numbers',url:'https://support.discogs.com/hc/en-us/articles/360005006614-Database-Guidelines-4-Label-Catalog-Number'},
 runout:{title:'Discogs barcodes and identifiers',url:'https://support.discogs.com/hc/en-us/articles/360005054893-Database-Guidelines-5-Barcodes-Identifiers'},
 instrument:{title:'Fender serial identification',url:'https://serialnumberlookup.fender.com/'},
 lego:{title:'LEGO set and piece identifiers',url:'https://www.lego.com/en-gb/service/help-topics/article/identifying-lego-set-and-piece-numbers'},
 gems:{title:'GIA diamond report fields',url:'https://www.gia.edu/analysis-grading-sample-report-diamond?reporttype=diamond-grading-report'},
 watches:{title:'Seiko manufacturer specifications',url:'https://www.seikowatches.com/se-en/products/5sports/srpe55'},
 coins:{title:'PCGS certification identity fields',url:'https://www.pcgs.com/news/tips-for-using-pcgs-certification-verification'},
 books:{title:'Library of Congress bibliographic record',url:'https://www.loc.gov/programs/cataloging-in-publication/data/'},
 vehicle:{title:'NHTSA vehicle identification',url:'https://www.nhtsa.gov/vin-decoder'},
 plants:{title:'RHS botanical and cultivar naming',url:'https://www.rhs.org.uk/plants/horticulture-hub/plant-registration'},
 hardware:{title:'Nintendo device serial identification',url:'https://en-americas-support.nintendo.com/app/answers/detail/a_id/58879'},
 tcg:{title:'Scryfall official card field definitions',url:'https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts'},
 stamps:{title:'American Philatelic Society stamp identification',url:'https://stamps.org/news/news-archives/c/collecting-insights/cat/exploring-stamps/post/c3a-stamp-basics-highlight-part-2'}
};
const families={};
function add(u,c,s,fields){families[u+'|'+c]={sourceIds:s.split(','),fields:fields.split('|')}}
add('POP_CULTURE','Comics','comics','Series / title|Issue number|Publisher|Publication date|Cover variant|Printing / edition|Language|Grading company|Grade|Certification number|Page quality|Restoration status');
add('POP_CULTURE','Toys & Figures','object','Character|Brand|Product line|Release year|Model / product number|Scale|Edition / exclusive|Packaging condition|Box included|Accessories included|Completeness');
add('POP_CULTURE','Movies / TV / Film','object','Film / show|Studio / maker|Release year|Edition|Format / material|Country / region|Dimensions|Provenance|Condition');
add('POP_CULTURE','Die-Cast & Vehicles','object','Brand|Vehicle make / model|Series|Model / product number|Release year|Scale|Color / livery|Casting / base marks|Packaging condition|Variant');
add('POP_CULTURE','Lego & Brick Systems','lego','Set name|Set / product number|Theme / line|Release year|Completeness|Missing pieces|Minifigures included|Instructions included|Box included');
add('POP_CULTURE','Disney & Cartoon Collectibles','object','Character / franchise|Maker|Collection / series|Release year|Edition / exclusive|Material|Dimensions|Condition|Original packaging');
add('POP_CULTURE','Collectible Art Plates','object','Artist / designer|Maker|Series|Plate number|Edition size|Material|Diameter|Year / period|Backstamp|Certificate included');
add('POP_CULTURE','Art Cards','cards,object','Artist|Set / series|Card number|Publisher / maker|Release year|Medium / finish|Edition numerator|Edition denominator|Signature status|Certification number');
add('SPORTS','Sports Cards','cards','Player / athlete|Sport|Team|Manufacturer|Set / series|Release year|Card number|Parallel / variant|Grading company|Grade|Certification number|Language');
add('SPORTS','Apparel','object','Player / team|Brand|Season / year|Garment type|Size|Material|Colorway|Condition|Authenticity documentation');
add('SPORTS','Memorabilia','cards,object','Player / team|Sport|Event|Event date|Maker|Material|Dimensions|Signature status|Authentication company|Certification number|Provenance');
add('TCG','TCG / CCG','cards,tcg','Card name|Game|Set / series|Set code|Collector number|Release year|Language|Rarity|Finish / foil|Parallel / variant|Grading company|Grade|Certification number');
add('TCG','Non-Sport Collectible','cards','Subject / character|Franchise|Manufacturer|Set / series|Release year|Card number|Parallel / variant|Finish / foil|Grading company|Grade|Certification number');
add('TCG','Sealed Product','cards','Game / franchise|Manufacturer|Set / series|Set code|Release year|Language|Product / barcode|Packaging condition|Factory seal condition|Pack count|Cards per pack');
add('TCG','Accessories','object','Brand|Game compatibility|Product / model|Material|Dimensions|Capacity|Color / design|Condition|Original packaging');
add('MUSIC','Audio Formats','records,runout','Artist / performer|Release title|Label|Catalog number|Release year|Country / market|Edition / pressing|Media condition|Packaging condition|Barcode');
add('MUSIC','Audio Players','instrument,object','Brand|Model|Serial number|Manufacture year / period|Country of manufacture|Finish / color|Working condition|Service history|Included accessories');
add('MUSIC','Print & Ephemera','books,object','Artist / performer|Tour / event / publication|Event / publication date|Venue|Publisher / maker|Edition / issue|Dimensions|Material|Condition');
add('MUSIC','Instruments & Gear','instrument','Brand|Model|Serial number|Manufacture year / period|Country of manufacture|Finish / color|Working condition|Modifications|Service history|Case / accessories');
add('JEWELRY_APPAREL','Jewelry','gems,object','Maker|Material / metal|Purity / hallmark|Gemstone|Weight|Dimensions|Year / period|Signature / marks|Condition|Certificate / report number');
add('JEWELRY_APPAREL','Watches','watches','Brand|Reference / model|Serial number|Year / period|Movement|Caliber|Case material|Case size|Dial color|Strap / bracelet|Service history|Box included|Papers included');
add('JEWELRY_APPAREL','Bags & Luggage','object','Brand|Model / style|Style / date code|Year / season|Material|Color|Hardware|Dimensions|Condition|Authentication documentation|Dust bag included|Box included');
add('JEWELRY_APPAREL','Apparel','object','Brand|Designer / collaboration|Style / product code|Year / season|Size|Material|Colorway|Measurements|Condition|Original tags');
add('JEWELRY_APPAREL','Footwear','object','Brand|Model / style|Style / product code|Release year|Size|Sizing system|Colorway|Material|Condition|Box included');
add('JEWELRY_APPAREL','Eyewear','object','Brand|Model / reference|Frame material|Frame color|Lens type|Lens width|Bridge width|Temple length|Condition|Case included');
add('GAMES','Video Games','hardware,books','Title|Platform|Publisher|Developer|Release year|Region|Language|Product / catalog code|Edition|Completeness|Media condition|Box condition|Manual included|Grading company|Grade');
add('GAMES','Hardware','hardware','Brand|Platform|Model / revision|Serial number|Release year|Region|Color / edition|Tested status|Controller count|Cables included|Box included|Modifications');
add('GAMES','Accessories','hardware,object','Brand|Product / model|Compatible platforms|Region / connector|Color / variant|Working condition|Serial number|Original packaging');
add('GAMES','Arcade & Coin-Op','hardware,object','Maker|Game / machine title|Model|Serial number|Year / period|Cabinet / form|Working condition|Restoration / modifications|Dimensions|Documentation');
add('GAMES','Tabletop & Board','books,object','Title / system|Publisher / maker|Edition / printing|Release year|Language|Product / catalog code|Completeness|Box condition|Rulebook included');
add('GAMES','Gaming Swag','object','Game / franchise|Publisher / maker|Event / promotion|Release year|Edition / exclusive|Material|Dimensions|Completeness|Condition');
add('BUILT_BOTANY','Handmade','object','Maker|Work title|Date / period|Material|Technique|Dimensions|Signature / marks|Edition / unique|Condition|Provenance');
add('BUILT_BOTANY','Bar','object','Producer / distillery|Expression / label|Country / region|Vintage / stated age|Bottling year|Bottle volume|Alcohol by volume|Batch / bottle number|Seal / fill condition|Original packaging');
add('BUILT_BOTANY','Plants','plants','Botanical name|Cultivar|Common name|Source / nursery|Propagation method|Acquired date|Plant size|Pot size|Condition notes|Label / accession number');
add('BUILT_BOTANY','Garden & Tools','object','Maker|Model / product|Material|Dimensions|Year / period|Condition|Working condition|Included parts');
add('BUILT_BOTANY','Smoke / Tobacciana','object','Maker|Model / series|Country / region|Year / period|Material|Dimensions|Signature / marks|Condition|Original packaging');
add('MISC','Collectors Choice','object','Maker / attribution|Object type|Date / period|Place of origin|Material|Dimensions|Inscriptions / marks|Provenance|Condition|Documentation');
add('MISC','Books','books,object','Title|Author / creator|Publisher|Publication date|Edition / printing|ISBN / catalog number|Language|Binding|Condition|Signature status|Provenance');
add('MISC','Coins & Currency','coins','Country / issuing authority|Denomination|Date / series|Mint|Mint mark|Metal / material|Weight|Diameter / dimensions|Grading company|Grade|Certification number|Variety / error');
add('MISC','Stamps','stamps','Country / issuing authority|Issue / series|Issue date|Denomination|Catalog system|Catalog number|Perforation|Watermark|Printing method|Used / unused|Gum condition|Cancellation|Certification number');
add('MISC','Armory & Blades','object','Maker|Model / pattern|Serial number|Date / period|Country of origin|Material|Dimensions|Markings|Condition|Provenance');
add('MISC','Supplies & Display','object','Maker|Model / product|Material|Dimensions|Capacity|Compatible item sizes|Quantity|Condition');
add('AUTOMOTIVE','Classic Cars','vehicle','Make|Model|Model year|VIN / chassis number|Body style|Engine|Transmission|Odometer reading|Odometer unit|Exterior color|Restoration / modifications|Condition');
add('AUTOMOTIVE','Car Parts','vehicle,object','Maker|Part number|Compatible make / model|Compatible year range|Casting / serial number|Material|Finish|Dimensions|Condition|Original / reproduction');
add('AUTOMOTIVE','Motorcycles','vehicle','Make|Model|Model year|VIN / frame number|Engine number|Engine displacement|Odometer reading|Odometer unit|Color|Restoration / modifications|Condition');
add('AUTOMOTIVE','Motorcycle Parts','vehicle,object','Maker|Part number|Compatible make / model|Compatible year range|Casting / serial number|Material|Finish|Dimensions|Condition|Original / reproduction');
add('AUTOMOTIVE','Classic Bicycles','object','Maker|Model|Year / period|Frame number|Frame material|Frame size|Wheel size|Color|Components / originality|Restoration|Condition');
add('AUTOMOTIVE','Bicycle Parts','object','Maker|Model / part number|Compatible bicycle / standard|Year / period|Material|Dimensions / fitment|Finish|Condition|Original / reproduction');
add('ART','Painting','object','Artist / attribution|Work title|Creation date / period|Medium|Surface / support|Height|Width|Dimensions unit|Signature status|Signature location|Provenance|Condition|Framed');
add('ART','Sculpture','object','Artist / attribution|Work title|Creation date / period|Material|Technique|Height|Width|Depth|Dimensions unit|Edition numerator|Edition denominator|Foundry / maker marks|Provenance|Condition');
families['ART|Art Cards']=families['POP_CULTURE|Art Cards'];

// Additions below are VLTD product recommendations, not copied official schemas.
function extra(u,c,s){
 const a=[];const push=x=>a.push(...x.split('|'));
 if(c==='Comics'){
  if(/Original Art|Original Comic Art/.test(s)) return {replace:['Artist','Series / title','Issue number','Page number / cover','Penciller','Inker','Colorist','Medium','Height','Width','Dimensions unit','Signature status','Provenance'],note:'Original art is a unique work, not a published comic; issue/page references remain optional.'};
  if(/Limited Prints/.test(s)) return {replace:['Artist','Work title','Print technique','Paper / support','Edition numerator','Edition denominator','Height','Width','Dimensions unit','Signature status','Provenance']};
  if(s==='Sketch Cards') return {replace:families['ART|Art Cards'].fields.concat(['Original or reproduction','Card dimensions'])};
  if(/Omnibuses|Squarebound/.test(s))push('ISBN / catalog number|Volume number|Binding');
  if(s==='Ashcans')push('Promotional purpose|Distribution / event');
  if(s==='Fanzines')push('Editor / publisher|Issue / volume');
 }
 if(c==='Toys & Figures'){
  if(s==='Legos')return {replace:families['POP_CULTURE|Lego & Brick Systems'].fields};
  if(/Model Kits/.test(s))push('Assembly status|Sprues complete|Decals included');
  if(/Plush/.test(s))push('Height|Fabric|Hang tags attached');
  if(/Statues|Busts/.test(s))push('Sculptor|Material|Edition numerator|Edition denominator|Height');
  if(/Hot Toys|Nendoroids|Action Figures/.test(s))push('Alternate parts included|Articulation condition');
  if(/Funko Pops/.test(s))push('Box number|Sticker / exclusive|Box protector');
  if(s==='Designer Toys')push('Artist / designer|Production run');
 }
 if(c==='Movies / TV / Film'){
  if(/VHS|DVD|Laser Disc/.test(s))push('Distributor|Catalog number|Language|Region / television standard|Media condition|Case / sleeve condition|Insert included');
  if(s==='Film Reels')push('Film gauge|Reel count|Running length|Sound / silent|Color / monochrome|Inspection notes');
  if(s==='Film Cells')push('Scene / frame reference|Film gauge|Cell count|Mounted / framed|Certificate included');
  if(s==='Props')push('Production / character association|Screen-use claim|Evidence / source|Replica status');
  if(/Posters|Pictures/.test(s))push('Artist / photographer|Print technique|Original / reproduction|Framed|Signature status');
 }
 if(c==='Die-Cast & Vehicles'){
  if(s==='Model Kits')push('Assembly status|Sprues complete|Decals included');
  if(/Model Trains/.test(s))push('Gauge|Railroad / road number|Powered|Electrical system');
  if(/Slot Cars/.test(s))push('Track system|Motor / working condition');
  if(s==='Error Cars')push('Observed error|Evidence photographs');
  if(s==='Redlines')push('Wheel type|Base country / marks');
  if(s==='Model Aircraft')push('Aircraft type|Registration / livery');
 }
 if(c==='Lego & Brick Systems'){
  if(s==='Minifigures')return {replace:['Character','Figure identifier','Theme / line','Release year','Print variant','Accessories included','Condition','Original packaging']};
  if(s==='Loose Bricks & Bulk')return {replace:['Element / design number','Color','Quantity','Weight','Dimensions unit','Condition','Sorting notes']};
  if(s==='Technic & Robotics')push('Motor / hub included|Electronics tested');
  if(s==='System Sets'||s==='Ultimate Collector Series (UCS)')push('Piece count|Built / unbuilt');
 }
 if(c==='Disney & Cartoon Collectibles'){
  if(s==='Pins')push('Pin identifier|Backstamp|Backing card|Pin back / clasp');
  if(s==='Animation Cels')push('Production|Character / scene|Sequence / cel number|Original / reproduction|Background included');
  if(s==='Lithographs')push('Artist|Edition numerator|Edition denominator|Signature status');
  if(s==='Snowglobes')push('Mechanism tested|Liquid / bubble condition|Dimensions');
  if(s==='Theme Park Exclusives')push('Park / event|Exclusive release date');
  if(s==='Ears / Headwear')push('Size|Fabric|Tags attached');
 }
 if(c==='Collectible Art Plates'&&s==='Hand-Painted Porcelain')push('Painter signature|Painting technique');
 if(c==='Art Cards'){
  if(s==='Sketch Cards')push('Original or reproduction|Character / subject|Commissioned');
  if(s==='Original Autographed Cards')push('Signer|Authentication company|Signature medium');
  if(s==='Printing Plates')push('Plate color / channel|Source card|Plate material');
  if(s==='Acetate Cards')push('Layer / transparency');
  if(s==='Metal Cards')push('Metal type');
  if(s==='Limited Prints')push('Print technique');
 }
 if(u==='SPORTS'&&c==='Sports Cards'){
  if(['Basketball','Football','Baseball','Soccer','Hockey','Racing','UFC / MMA','Golf'].includes(s))push('Season / competition');
  if(s==='Rookie Cards')push('Rookie designation|Rookie designation source');
  if(s==='Patch / Relic Cards')push('Relic material|Game-used / player-worn claim|Claim source');
  if(s==='Case Hits')push('Insert name');
  if(s==='Autographed Cards')push('Signer|On-card / sticker|Authentication company');
  if(s==='Racing')push('Driver|Constructor / car');
 }
 if(u==='SPORTS'&&c==='Apparel'){
  if(/Jerseys|Player Exclusives|Sideline/.test(s))push('Player number|Game-issued / game-worn claim|Claim source');
  if(s==='Caps & Hats')push('Fitted size|Closure style');
  if(s==='Championship Merch')push('Championship / event');
 }
 if(u==='SPORTS'&&c==='Memorabilia'){
  if(/Autographs|Signed Photos/.test(s))push('Signer|Signing date|Witnessed|Inscription');
  if(/Game-Worn Jerseys|Game-Used Equipment/.test(s))push('Use claim|Claim source|Season / game reference');
  if(/Game Tickets|Programs & Ticket Stubs/.test(s))push('Venue|Seat / section|Ticket format|Full ticket / stub');
  if(/Rings|Medals/.test(s))push('Recipient / attribution|Material|Weight|Size');
  if(s==='Skateboards')push('Deck maker|Deck width|Rider / graphic|Complete / deck only');
  if(s==='Trading Pins')push('Backstamp|Backing / clasp');
 }
 if(u==='TCG'&&c==='TCG / CCG'){
  if(s==='Magic: The Gathering')push('Frame treatment|Promo stamp|Serialized numerator|Serialized denominator');
  if(s==='Pokemon')push('Set symbol / regulation mark|Edition stamp|Holo pattern');
  if(s==='Yu-Gi-Oh')push('Edition stamp|Print region|Passcode');
  if(s==='Lorcana')push('Ink color|Promo stamp');
  if(s==='One Piece')push('Set / card prefix|Alternate-art designation');
  if(s==='Flesh and Blood')push('Edition stamp|Foil treatment');
  if(s==='Weiss Schwarz')push('Title / franchise|Parallel stamp');
  if(s==='Vintage / Dead TCGs'||s==='Other')push('Game name as printed|Publisher');
  if(s==='Star Wars'||s==='Dragon Ball Z'||s==='Bo Jackson Arena')push('Game edition / publisher');
 }
 if(u==='TCG'&&c==='Non-Sport Collectible'){
  if(s==='History')push('Person / event|Date / period depicted|Artifact claim source');
  if(s==='Keepsake Edition')push('Release / edition name|Relic material|Relic claim source|Signature type');
  if(s==='Movie'||s==='TV')push('Production title|Season / film installment');
  if(s==='HiroQuest Genesis')push('Character / faction');
 }
 if(u==='TCG'&&c==='Sealed Product'){
  if(s==='Booster Boxes')push('Packs per box');
  if(s==='Starter Decks')push('Deck name|Deck edition');
  if(s==='Elite Trainer Boxes'||s==='Gift Sets')push('Included contents|Promo included');
  if(s==='Blister Packs')push('Blister configuration|Promo included');
 }
 if(u==='TCG'&&c==='Accessories'){
  if(/Sleeves|Toploaders/.test(s))push('Internal dimensions|Pack count|Thickness');
  if(/Deck Boxes|Binders/.test(s))push('Card capacity|Page / closure format');
  if(s==='Playmats')push('Artist / design|Width|Height|Dimensions unit');
  if(s==='Dice & Counters')push('Piece count|Dice sides');
 }
 if(u==='MUSIC'&&c==='Audio Formats'){
  if(s==='Digital Media')return {replace:['Artist / performer','Release title','Label','Release year','Edition','File format','Source reference'],note:'Flag: this subcategory conflicts with the physical-collectibles-only scope. Do not add credential/license-key fields or silently change taxonomy.'};
  if(/Vinyl|Shellac|Acetate|Flexi/.test(s))push('Matrix / runout|Speed RPM|Disc diameter|Disc count|Material / color|Sleeve condition|Inserts included');
  if(s==='CDs')push('Matrix / runout|SID / mould code|Disc count|Booklet included');
  if(s==='Cassette Tapes'||s==='8-Track')push('Tape / cartridge type|Shell color|Playback condition|Insert included');
  if(s==='Reel-to-Reel')push('Reel diameter|Tape width|Tape speed|Track configuration');
  if(s==='Minidisc')push('Factory release / recordable|Catalog / disc code|Booklet included');
 }
 if(u==='MUSIC'&&c==='Audio Players'){
  if(s==='Walkman')push('Supported media|Battery compartment condition|Headphones included');
  if(s==='Record Player')push('Drive type|Supported speeds|Cartridge / stylus|Tonearm condition');
  if(s==='Amps')push('Amplifier type|Rated output|Speaker configuration|Voltage');
 }
 if(u==='MUSIC'&&c==='Print & Ephemera'){
  if(s==='Sheet Music')push('Composer|Arranger|Instrumentation|Publisher plate number');
  if(s==='Backstage Passes')push('Pass type|Lamination|Use claim source');
  if(s==='Gig Posters')push('Artist|Printing technique|Edition numerator|Edition denominator');
  if(s==='Ticket Stubs')push('Seat / section|Full ticket / stub');
  if(s==='Music Magazines')push('Issue / volume|Cover subject');
 }
 if(u==='MUSIC'&&c==='Instruments & Gear'){
  if(s==='Guitars'||s==='Bass')push('Body type|String count|Pickup configuration|Neck / fret condition');
  if(s==='Drums')push('Shell material|Shell sizes|Hardware included|Piece count');
  if(s==='Keys / Synths')push('Key count|Synthesis / instrument type|Power supply included');
  if(s==='Brass / Woodwind')push('Instrument type|Key / pitch|Material|Mouthpiece included');
  if(s==='Pedals & Effects')push('Effect type|Power requirement|Circuit / revision');
  if(s==='Vintage Amps')push('Amplifier type|Circuit / chassis code|Rated output|Speaker configuration|Voltage');
  if(s==='Microphones')push('Microphone type|Polar pattern|Connector|Power requirement');
  if(s==='DJ Gear')push('Equipment type|Channel count|Supported media|Firmware / revision');
  if(s==='Stage-Used Gear')push('Performer|Event / tour|Use date|Use claim source|Provenance');
 }
 if(u==='JEWELRY_APPAREL'&&c==='Jewelry'){
  if(s==='Rings')push('Ring size|Sizing system');
  if(s==='Necklaces'||s==='Bracelets')push('Length|Clasp type');
  if(s==='Earrings')push('Pair / single|Fastening');
  if(s==='Brooches'||s==='Pins')push('Fastening|Backstamp');
  push('Stone count|Stone treatment disclosure');
 }
 if(c==='Watches'){
  if(s==='Pocket Watches')push('Case style|Chain included');
  if(s==='Quartz')push('Battery / service date');
  if(s==='Mechanical'||s==='Automatic'||s==='Manual Wind')push('Winding type|Complications');
 }
 if(c==='Bags & Luggage')push(s==='Suitcases'?'Wheel / handle condition|Lock hardware condition':'Strap / handles|Lining condition');
 if(u==='JEWELRY_APPAREL'&&c==='Apparel')push(/Hats/.test(s)?'Hat size|Closure':'Label size|Sizing system');
 if(c==='Footwear'&&s==='Cleats')push('Sport|Stud / sole type');
 if(c==='Eyewear'&&s==='Prescription Frames')push('Frame-only / lenses included');
 if(u==='GAMES'&&c==='Video Games'){
  if(s==='Loose')push('Loose media type|Label condition');
  if(s==='CIB')push('Included inserts|Map included');
  if(s==='Limited / Collectors Editions')push('Edition contents|Bonus items complete');
  if(s==='Big Box PC')push('Media count|System requirements as printed');
  if(s==='Demos & Promos')push('Promotion / distribution');
  if(s==='Steelbooks')push('Disc included|Case artwork / variant');
  if(s==='Homebrew')push('Developer / maker|Release run');
  if(s==='Prototype / Alpha')push('Build date / revision|Provenance|Hardware compatibility');
 }
 if(u==='GAMES'&&c==='Hardware'){
  if(s==='Dev & Test Kits')push('Developer unit identifier|Revision|Provenance');
  if(s==='Virtual Reality')push('Headset revision|Controllers / sensors included');
  if(s==='Store Kiosks')push('Cabinet dimensions|Display included|Provenance');
  if(s==='Handhelds')push('Screen condition|Battery condition');
 }
 if(u==='GAMES'&&c==='Accessories'){
  if(s==='Power Supplies')push('Input voltage|Output voltage / current|Polarity');
  if(s==='AV Cables'||s==='Link Cables')push('Connector ends|Length');
  if(s==='Controllers'||s==='Arcade Sticks')push('Wired / wireless|Button / stick condition');
  if(s==='Memory Cards')push('Storage capacity');
  if(s==='Mod Chips / Hardware')push('Hardware revision');
 }
 if(c==='Arcade & Coin-Op'){
  if(/Marquees|Bezels/.test(s))return {replace:['Game / machine title','Maker','Year / period','Material','Width','Height','Dimensions unit','Original / reproduction','Condition']};
  if(s==='Tokens')return {replace:['Issuer / venue','Date / period','Material','Diameter','Weight','Inscriptions / marks','Condition']};
  if(s==='Service Manuals')return {replace:['Maker','Game / machine title','Manual / publication number','Edition / revision','Publication date','Page count','Condition']};
  if(s==='Arcade Boards (PCBs)')push('Board revision|Connector standard|Tested status');
  if(s==='Pinball Machines')push('Playfield condition|Backglass condition|Electronics condition');
 }
 if(c==='Tabletop & Board'){
  if(s==='Role-Playing Books'||s==='Strategy Guides')return {replace:families['MISC|Books'].fields.concat(['Game / system','Rules edition'])};
  if(s==='Miniatures')push('Scale|Material|Painted / unpainted|Unit / faction');
  if(s==='Dice Games')push('Dice count');
  if(s==='Mats & Terrain')push('Dimensions|Material|Scale');
 }
 if(c==='Gaming Swag'){
  if(s==='Soundtracks')return {replace:families['MUSIC|Audio Formats'].fields.concat(['Game / franchise','Physical audio format'])};
  if(s==='Art Books')return {replace:families['MISC|Books'].fields.concat(['Game / franchise'])};
  if(s==='Apparel')return {replace:families['JEWELRY_APPAREL|Apparel'].fields.concat(['Game / franchise'])};
  if(s==='Press Kits')push('Kit contents|Press event|Distribution');
 }
 if(c==='Handmade'){
  if(s==='Ceramics')push('Clay body|Glaze|Firing technique');
  if(s==='Woodwork')push('Wood species|Finish|Joinery');
  if(s==='Metalwork')push('Metal / alloy|Finish');
  if(s==='Textiles')push('Fiber|Weave / stitch');
  if(s==='Leatherwork')push('Leather type|Tannage / finish');
  if(s==='Jewelry')push('Metal / hallmark|Gemstone|Wearable size');
  if(s==='Resin')push('Resin type|Inclusions');
  if(s==='Glass')push('Glass technique|Color');
  if(s==='Paper & Origami')push('Paper type|Fold / construction');
 }
 if(c==='Bar'){
  if(s==='Wine')push('Grape variety|Appellation|Vintage|Producer lot');
  if(['Whisky','Scotch','Bourbon','Rum'].includes(s))push('Cask type|Cask number|Age statement');
  if(s==='Tequila')push('Producer identifier as printed|Agave designation');
  if(s==='Gin')push('Style / edition');
 }
 if(c==='Plants'){
  if(s==='Bonsai')push('Style|Training history|Container maker');
  if(s==='Seeds & Bulbs')push('Lot / batch|Quantity|Harvest / packed date|Stored condition');
  if(s==='Terrariums')push('Species list|Vessel dimensions|Assembly date');
  if(s==='Air Plants')push('Mount / support');
  if(s==='Rare & Exotic')push('Acquisition provenance');
 }
 if(c==='Garden & Tools'){
  if(s==='Pots & Planters')push('Pot diameter|Drainage|Maker marks');
  if(s==='Soil & Amendments')push('Product composition as printed|Bag volume / weight|Lot / batch');
 }
 if(c==='Smoke / Tobacciana'){
  if(s==='Cigars')push('Brand / line|Vitola|Length|Ring gauge|Box / batch code|Quantity');
  if(s==='Humidors')push('Capacity|Lining material|Mechanism condition');
  if(s==='Lighters')push('Fuel / ignition type|Working condition');
  if(s==='Pipes')push('Pipe material|Shape|Stem condition');
  if(s==='Tobacco Tins'||s==='Matchbooks')push('Brand / advertising|Contents present|Seal condition');
 }
 if(c==='Collectors Choice'){
  if(s==='Replicas')push('Original object represented|Replica maker|Replica scale');
  if(s==='Historical Documents')push('Author / issuer|Document date|Language|Signature status|Page count');
  if(s==='Antiquities')push('Attributed culture|Attribution source|Ownership history|Restoration');
  if(s==='Military Surplus')push('Branch / unit|Pattern / designation|Service period|Original / reproduction');
 }
 if(c==='Books'){
  if(s==='Historical Documents')push('Document type|Author / issuer|Page count|Signature / seal');
  if(s==='Antiquities')push('Date / period attribution|Attribution source|Material|Ownership history');
  if(s==='Autographs')push('Signer|Inscription|Authentication company|Certification number');
  if(s==='First Editions'||s==='Rare Printings')push('Edition evidence / number line|Dust jacket condition');
 }
 if(c==='Coins & Currency'){
  if(['Bills','Misprints','Silver Certificates'].includes(s))push('Serial / block number|Signature combination|Seal type|Paper condition');
  if(s==='Bullion')push('Fineness|Fine metal weight|Weight unit');
  if(s==='Proof Sets')push('Set contents|Case / certificate included');
  if(s==='Ancient Coins')push('Ruler / authority|Attribution / reference|Provenance');
  if(s==='Errors')push('Error description|Attribution source');
 }
 if(c==='Stamps'){
  if(s==='Covers'||s==='First Day Covers')push('Postmark date|Postmark location|Cachet|Cover condition');
  if(s==='Sheets'||s==='Blocks')push('Row / column count|Selvage|Plate number');
  if(s==='Errors')push('Error description|Expertization reference');
  if(s==='Postcards')push('Publisher / photographer|Subject / place|Divided back|Posted date');
  if(s==='Revenue Stamps')push('Revenue purpose|Issuer');
 }
 if(c==='Armory & Blades'){
  if(['Pistols','Rifles','Shotguns','Muskets'].includes(s))push('Caliber / gauge as marked|Barrel length|Mechanism type|Deactivated / replica status');
  else push('Blade length|Blade material|Handle material|Sheath / scabbard included');
 }
 if(c==='Supplies & Display'){
  if(s==='Sleeves & Holders')push('Internal width|Internal height|Thickness / capacity');
  if(s==='Display Cases')push('Display capacity|Glazing material');
  if(s==='Storage Boxes')push('Item capacity|Divider configuration');
  if(s==='Shelving & Racks')push('Shelf count|Assembly status');
 }
 if(c==='Classic Cars'&&s==='Project Cars'||c==='Classic Cars'&&s==='Restoration Shells')push('Restoration stage|Missing components');
 if(c==='Car Parts'){
  if(s==='Engines')push('Engine code|Displacement|Completeness|Tested status');
  if(s==='Transmissions')push('Transmission code|Gear count|Tested status');
  if(s==='Gauges')push('Gauge type|Units|Tested status');
  if(s==='Hubcaps'||s==='Steering Wheels')push('Diameter|Fitment / mounting');
  if(s==='Carburetors')push('Carburetor code|Barrel count');
 }
 if(c==='Motorcycles'&&s==='Sidecars')push('Mounting compatibility|Wheel / body configuration');
 if(c==='Motorcycle Parts'){
  if(s==='Engines')push('Engine code|Displacement|Tested status');
  if(s==='Frames')push('Frame number|Geometry / fitment');
  if(s==='Carbs')push('Bore size|Model code');
 }
 if(c==='Classic Bicycles'&&s==='BMX (Vintage 80s)')push('Wheel diameter|Period-correct components');
 if(c==='Bicycle Parts'){
  if(s==='Frames')push('Frame size|Bottom bracket standard');
  if(s==='Forks')push('Steerer size|Axle standard');
  if(s==='Handlebars'||s==='Banana Seats'||s==='Sissy Bars')push('Mount / clamp size');
  if(s==='Pedals')push('Thread size');
  if(s==='Chains')push('Pitch / width|Link count');
 }
 if(c==='Painting'){
  if(s==='Limited Prints'||s==='Posters')push('Printing technique|Edition numerator|Edition denominator|Publisher / printer');
  if(s==='Sketches')push('Drawing material|Study / finished work');
 }
 if(c==='Sculpture'){
  if(s==='Kinetic / Mobile')push('Mechanism|Working condition|Installation notes');
  if(s==='Installation')push('Component inventory|Installed dimensions|Assembly documentation');
  if(s==='Wall Relief')push('Mounting method');
 }
 return {add:a};
}

const commonMap={'Serial number':'serialNumber','Grade':'grade','Certification number':'certNumber','Brand':'brand','Model / product number':'number','Series / title':'subtitle','Player / athlete':'subject','Subject / character':'subject','Card number':'number','Set / series':'subtitle','Parallel / variant':'variant','Material':'material','Edition / printing':'edition','Language':'language','Country / region':'country','Dimensions':'dimensions','Condition':'condition'};
const modelSource=fs.readFileSync(path.resolve('src/lib/vaultModel.ts'),'utf8');
const modelKeys=new Set([...modelSource.slice(modelSource.indexOf('export type VaultItem'),modelSource.indexOf('type LoadItemsOptions')).matchAll(/^\s*(\w+)\??:/gm)].map(m=>m[1]));
function storage(u,c,label){
 const context={};
 if(c==='Comics')Object.assign(context,{'Publisher':'comicPublisher','Grading company':'comicGradingCompany','Issue number':'comicIssueNumber','Cover variant':'comicCoverVariant','Publication date':'comicCoverDate','Page quality':'comicPageQuality','Restoration status':'comicRestorationStatus'});
 if(c==='Sports Cards')Object.assign(context,{'Sport':'sportsSport','Team':'sportsTeam','Parallel / variant':'sportsParallelType','Grading company':'sportsGradingCompany'});
 if(u==='TCG'&&c==='TCG / CCG')Object.assign(context,{'Set code':'tcgSetCode','Language':'tcgLanguage','Rarity':'tcgRarity','Finish / foil':'tcgHoloType','Grading company':'tcgGradingCompany','Parallel / variant':'tcgParallelType'});
 if(c==='Audio Formats')Object.assign(context,{'Label':'vinylLabel','Matrix / runout':'vinylMatrix','Speed RPM':'vinylSpeedRpm','Country / market':'vinylCountry','Sleeve condition':'vinylSleeveCondition','Edition / pressing':'vinylPressing','Material / color':'vinylColor'});
 if(c==='Watches')Object.assign(context,{'Brand':'watchBrand','Reference / model':'watchReference','Movement':'watchMovement','Case material':'watchCaseMaterial','Case size':'watchCaseSize','Dial color':'watchDialColor','Box included':'watchBox','Papers included':'watchPapers'});
 if(c==='Bags & Luggage')Object.assign(context,{'Brand':'bagBrand','Material':'bagMaterial','Color':'bagColor','Hardware':'bagHardware','Dust bag included':'bagDustbag','Box included':'bagBox'});
 if(c==='Toys & Figures')Object.assign(context,{'Brand':'toyBrand','Product line':'toyLine','Scale':'toyScale','Packaging condition':'toyPackageCondition','Box included':'toyBoxIncluded','Accessories included':'toyAccessoriesIncluded','Completeness':'toyIsComplete'});
 if(c==='Painting'||c==='Sculpture')Object.assign(context,{'Medium':'artMedium','Surface / support':'artSurface','Height':'artHeight','Width':'artWidth','Depth':'artDepth','Signature location':'artSignatureLocation','Provenance':'artProvenance','Framed':'artIsFramed'});
 if(c==='Video Games')Object.assign(context,{'Platform':'gamePlatform','Publisher':'gamePublisher','Region':'gameRegion','Grading company':'gameGradingCompany','Manual included':'gameHasManual'});
 if(c==='Coins & Currency')Object.assign(context,{'Denomination':'coinDenomination','Country / issuing authority':'coinCountry','Mint':'coinMint','Mint mark':'coinMintMark','Grading company':'coinGradingCompany','Variety / error':'coinError'});
 if(c==='Art Cards')context['Artist']='artCardArtist';
 const key=context[label]||commonMap[label];
 return key&&modelKeys.has(key)?{status:'existing-key-candidate',key,check:'Confirm semantic fit and cloud serialization; do not migrate or overwrite automatically.'}:{status:'proposed-field',key:null,check:'Storage design needed; no database change authorized by this research.'};
}
function field(u,c,label,i){
 let control='text',options=null,unit=null;
 if(/included$|Framed$|Commissioned$|attached$|complete$/.test(label))control='yes-no-unknown';
 if(/count$|numerator$|denominator$|Quantity$/.test(label))control='nonnegative-integer';
 if(/Height$|Width$|Depth$|Weight$|Diameter$|size$|length$|volume$|RPM$|by volume$|displacement$/.test(label)&&!['Size','Sizing system'].includes(label)){control='number-with-unit';unit='Required alongside numeric measurement; choose units appropriate to item.';}
 if(/date/i.test(label)&&!/source|period|year|code|update|evidence/.test(label))control='partial-date';
 if(/year|period|Vintage/.test(label))control='year-or-period';
 if(/history|Provenance|notes|source|claim|documentation|Description|description/.test(label))control='multiline-text';
 if(label==='Language'){control='select-with-other';options=['English','Japanese','Other','Unknown'];}
 if(label==='Condition'||label==='Working condition'){control='select-with-other';options=label==='Working condition'?['Working','Partially working','Not working','Untested']:['User described','Professionally graded','Unknown'];}
 if(label==='Signature status'){control='select-with-other';options=['Unsigned','Signed, unverified','Signed, authenticated','Unknown'];}
 if(label==='Original / reproduction'){control='select-with-other';options=['Original','Reproduction','Unknown'];}
 if(label==='Completeness'){control='select-with-other';options=['Complete','Incomplete','Unknown'];}
 return {label,control,options,unit,required:false,priority:i<6?'primary':'additional',storage:storage(u,c,label)};
}
const rows=[];
for(const [u,cats]of Object.entries(taxonomy))for(const[c,subs]of Object.entries(cats)){
 const f=families[u+'|'+c];if(!f)throw Error('Unmapped category '+u+' / '+c);
 for(const s of subs){const e=extra(u,c,s);const labels=[...new Set(e.replace||f.fields.concat(e.add||[]))];rows.push({universe:u,category:c,subcategory:s,sourceIds:f.sourceIds,sourceBasis:'Primary sources support the field family; individual optional fields and subtype additions are VLTD design recommendations, not an official mandated schema.',note:e.note||'',fields:labels.map((l,i)=>field(u,c,l,i))});}
}
const result={date:'2026-10-15',status:'Research and design specification only; not implemented or deployed',coverage:{universes:Object.keys(taxonomy).length,categories:Object.keys(families).length,subcategoryEntries:rows.length},principles:[
 'One shared Details component chooses its fields from Universe + Category + Subcategory; no separate page redesign.',
 'Show up to six primary fields, then More details. Existing filled values remain visible even if classified additional.',
 'All category-specific fields are optional. Unknown is not zero, false, unauthenticated, or absent.',
 'Keep Purchase, financial values, Storage + tracking and private Notes separate and unchanged.',
 'Preserve entered fields when switching taxonomy; retain nonmatching fields under Other saved details rather than discarding them.',
 'Reuse verified existing item keys before adding storage. Candidate mappings are not authority to overwrite data.',
 'Serial numbers, edition numbers, card identifiers, catalog numbers and certification identifiers are strings preserving punctuation and leading zeros.',
 'Edition numerator/denominator identify a numbered copy; neither is the manufacturer serial or certification number.',
 'Never infer manufacturing year from purchase year, authentication from presence of a certificate, or genuine condition from a selected chip.',
 'Do not collect tax IDs, account credentials, license keys, government identity documents or home addresses as collectible metadata.',
 'No AI call, paid lookup, auto categorization, data migration or live app change is part of this research.',
 'The taxonomy is held constant. Existing mixed concepts (Rookie Cards versus sports, Digital Media versus physical scope) are flagged for later review, not silently renamed.',
 'Sources support category identification, not appraisal values, authenticity determinations or legal conclusions. Broad categories use Object ID principles; niche subtype additions need specialist review before enforcing validation.'
],sources,rows};
fs.writeFileSync(path.join(__dirname,'field-matrix.json'),JSON.stringify(result,null,2));
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sections=rows.map(r=>`<details data-search="${esc((r.universe+' '+r.category+' '+r.subcategory+' '+r.fields.map(f=>f.label).join(' ')).toLowerCase())}"><summary>${esc(r.universe)} → ${esc(r.category)} → <b>${esc(r.subcategory)}</b></summary>${r.note?'<p class="flag">'+esc(r.note)+'</p>':''}<table><tr><th>Field</th><th>Input</th><th>Placement</th><th>Storage candidate</th></tr>${r.fields.map(f=>`<tr><td>${esc(f.label)}</td><td>${esc(f.control)}${f.options?'<br>'+esc(f.options.join(' / ')):''}</td><td>${esc(f.priority)}</td><td>${f.storage.key?'<code>'+esc(f.storage.key)+'</code>':'New field proposal'}</td></tr>`).join('')}</table><p>${esc(r.sourceBasis)}</p><p>Sources: ${r.sourceIds.map(id=>`<a href="${sources[id].url}">${esc(sources[id].title)}</a>`).join(' · ')}</p></details>`).join('');
fs.writeFileSync(path.join(__dirname,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VLTD Details field research</title><style>body{font:16px/1.5 system-ui;background:#10151c;color:#e4e9ee;max-width:1200px;margin:32px auto;padding:0 20px}a{color:#59d8eb}details{border:1px solid #344354;border-radius:8px;margin:10px 0;padding:14px}summary{cursor:pointer}table{border-collapse:collapse;width:100%;font-size:14px;margin-top:16px}td,th{border-bottom:1px solid #344354;padding:8px;text-align:left}input{width:96%;padding:12px;background:#202b37;color:#fff;border:1px solid #53677c;border-radius:8px}.flag{color:#ffd28b}code{color:#85e2e9}.note{border-left:3px solid #59d8eb;padding:12px 18px;background:#1a2430}</style><h1>VLTD category-specific Details</h1><p><b>10 universes · 51 categories · ${rows.length} subcategory entries.</b> Research/design specification, 2026-10-15. Not implemented. Existing taxonomy retained.</p><div class="note"><b>What went wrong:</b> the requested research had been recorded but not delivered. Shelf and Museum remain in Vault code, and Shelf remains the default. No app code was changed in producing this specification.</div><h2>Implementation boundaries</h2><ul>${result.principles.map(p=>'<li>'+esc(p)+'</li>').join('')}</ul><p>Existing field mappings are candidates checked against the current VaultItem type; cloud read/write/import preservation must be verified before implementation. This is a first-pass field-selection matrix, not specialist certification for all 382 collectible niches.</p><h2>Browse all existing subcategories</h2><input id="search" aria-label="Filter field matrix" placeholder="Filter by universe, category, subcategory or field"><p id="count">${rows.length} entries</p>${sections}<script>const q=document.getElementById('search');q.addEventListener('input',()=>{let n=0;document.querySelectorAll('details').forEach(d=>{d.hidden=!d.dataset.search.includes(q.value.toLowerCase());if(!d.hidden)n++});document.getElementById('count').textContent=n+' entries'});</script></html>`);
console.log(JSON.stringify(result.coverage));
console.log('Fields: '+rows.reduce((n,r)=>n+r.fields.length,0)+' optional field placements; no app files changed.');
