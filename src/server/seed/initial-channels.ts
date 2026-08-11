export type SeedChannel = { providerId: string; name: string; handle: string };

const namesAndHandles: Array<[string, string]> = [
  ["3Blue1Brown", "@3blue1brown"], ["Veritasium", "@veritasium"], ["Kurzgesagt", "@kurzgesagt"], ["Numberphile", "@numberphile"],
  ["PBS Space Time", "@pbsspacetime"], ["SmarterEveryDay", "@smartereveryday"], ["Mark Rober", "@markrober"], ["Technology Connections", "@technologyconnections"],
  ["Adam Savage's Tested", "@tested"], ["Practical Engineering", "@PracticalEngineeringChannel"], ["Wendover Productions", "@Wendoverproductions"], ["Tom Scott", "@TomScottGo"],
  ["Computerphile", "@computerphile"], ["The Coding Train", "@TheCodingTrain"], ["Ben Eater", "@BenEater"], ["Fireship", "@Fireship"],
  ["ThePrimeTime", "@ThePrimeTimeagen"], ["Theo - t3.gg", "@t3dotgg"], ["Low Level Learning", "@LowLevelLearning"], ["Computer Science", "@ComputerScience"],
  ["MIT OpenCourseWare", "@mitocw"], ["Stanford Online", "@stanfordonline"], ["YaleCourses", "@YaleCourses"], ["CrashCourse", "@crashcourse"],
  ["The Royal Institution", "@TheRoyalInstitution"], ["Institute of Art and Ideas", "@iai"], ["The School of Life", "@theschooloflifetv"], ["Big Think", "@bigthink"],
  ["The Economist", "@TheEconomist"], ["Vox", "@Vox"], ["Johnny Harris", "@johnnyharris"], ["PolyMatter", "@PolyMatter"],
  ["The B1M", "@TheB1M"], ["City Beautiful", "@CityBeautifulOfficial"], ["Not Just Bikes", "@NotJustBikes"], ["Climate Town", "@climatetown"],
  ["Defunctland", "@Defunctland"], ["Townsends", "@townsends"], ["Technology Connections Extra", "@TechnologyConnectionsExtra"], ["The History Guy", "@TheHistoryGuyChannel"],
  ["Fall of Civilizations", "@FallofCivilizations"], ["Tasting History", "@TastingHistory"], ["Kings and Generals", "@KingsandGenerals"], ["Historia Civilis", "@HistoriaCivilis"],
  ["The Operations Room", "@TheOperationsRoom"], ["Epic History TV", "@EpicHistoryTV"], ["Voices of the Past", "@VoicesofthePast"], ["World War Two", "@WorldWarTwo"],
  ["Rick Beato", "@RickBeato"], ["Adam Neely", "@AdamNeely"], ["12tone", "@12tone"], ["Polyphonic", "@Polyphonic"],
  ["NPR Music", "@nprmusic"], ["KEXP", "@KEXP"], ["Tiny Desk Concerts", "@nprmusic-tinydesk"], ["Definitive Rock", "@definitiverock"],
  ["Binging with Babish", "@babishculinaryuniverse"], ["America's Test Kitchen", "@AmericasTestKitchen"], ["J. Kenji López-Alt", "@JKenjiLopezAlt"], ["Chinese Cooking Demystified", "@ChineseCookingDemystified"],
  ["Eater", "@eater"], ["Bon Appétit", "@bonappetit"], ["Serious Eats", "@seriouseats"], ["Pro Home Cooks", "@ProHomeCooks"],
  ["The Art Assignment", "@TheArtAssignment"], ["Smarthistory", "@smarthistory"], ["Great Art Explained", "@GreatArtExplained"], ["The Canvas", "@TheCanvas"],
  ["Every Frame a Painting", "@everyframeapainting"], ["Lessons from the Screenplay", "@LessonsfromtheScreenplay"], ["Nerdwriter1", "@Nerdwriter1"], ["Just Write", "@JustWrite"],
  ["The Take", "@thetake"], ["Patrick H Willems", "@patrickhwillems"], ["Like Stories of Old", "@LikeStoriesofOld"], ["Cinema Cartography", "@CinemaCartography"],
  ["MKBHD", "@mkbhd"], ["Marques Brownlee Clips", "@MKBHD"], ["Dave2D", "@Dave2D"], ["Linus Tech Tips", "@LinusTechTips"],
  ["Internet Shaquille", "@InternetShaquille"], ["DIY Perks", "@DIYPerks"], ["Louis Rossmann", "@LouisRossmann"], ["Asianometry", "@Asianometry"],
  ["Branch Education", "@BranchEducation"], ["Real Engineering", "@RealEngineering"], ["Engineering Explained", "@EngineeringExplained"], ["ElectroBOOM", "@ElectroBOOM"],
  ["The 8-Bit Guy", "@8BitGuy"], ["Retro Game Corps", "@RetroGameCorps"], ["Digital Foundry", "@DigitalFoundry"], ["Game Maker's Toolkit", "@GMTK"],
  ["Razbuten", "@Razbuten"], ["NoClip", "@NoclipDocs"], ["People Make Games", "@PeopleMakeGames"], ["Ahoy", "@XboxAhoy"],
  ["The Thought Emporium", "@TheThoughtEmporium"], ["Journey to the Microcosmos", "@journeytomicro"], ["Deep Look", "@DeepLook"], ["Crime Pays but Botany Doesn't", "@CrimePaysButBotanyDoesnt"],
  ["Mossy Earth", "@MossyEarth"], ["PBS Terra", "@PBSTerra"], ["OceanX", "@OceanX"], ["SciShow", "@SciShow"],
  ["The Strongest Minds", "@TheStrongestMinds"], ["Huberman Lab", "@hubermanlab"], ["The Happiness Lab", "@TheHappinessLab"], ["Hidden Brain", "@HiddenBrain"],
  ["99% Invisible", "@99percentinvisiblepodcast"], ["Radiolab", "@Radiolab"], ["The Rest Is History", "@TheRestIsHistory"], ["The Ezra Klein Show", "@EzraKleinShow"],
  ["Freakonomics Radio", "@freakonomics"], ["Revisionist History", "@pushkin"], ["Cautionary Tales", "@PushkinPodcasts"], ["The Moth", "@TheMoth"],
  ["Lofi Girl", "@LofiGirl"], ["Cafe Music BGM channel", "@cafe_music_BGMchannel"], ["Chillhop Music", "@Chillhopdotcom"], ["COLORS", "@COLORSxSTUDIOS"],
  ["NPR", "@npr"], ["PBS NewsHour", "@PBSNewsHour"], ["60 Minutes", "@60Minutes"], ["Frontline PBS", "@frontlinepbs"],
  ["DW Documentary", "@DWDocumentary"], ["Al Jazeera English", "@AlJazeeraEnglish"], ["The Guardian", "@theguardian"], ["The New Yorker", "@newyorker"],
  ["The Atlantic", "@TheAtlantic"], ["The Verge", "@TheVerge"], ["Wired", "@WIRED"], ["Ars Technica", "@arstechnica"]
];

export const initialChannels: SeedChannel[] = namesAndHandles.map(([name, handle]) => ({ providerId: handle, name, handle }));
