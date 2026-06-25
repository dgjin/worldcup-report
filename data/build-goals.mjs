// 从已验证的真实数据源构建 goals.json
// 数据来源：footballtransfers.com, football-iq.app, worldcuppass.com, sportsmole.co.uk
// 所有进球数据均来自公开赛报，确保真实可靠。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ⚽ 进球数据（已验证真实来源）
// 格式："主队|客队": [{ minute, team:{name}, scorer:{name}, assist:{name}, type }]
// 分钟数从 football-iq.app / worldcuppass.com / sportsmole.co.uk 验证
// 射手名从 footballtransfers.com 射手榜交叉验证

const DATA = {
  // ====== GROUP A ======
  "Mexico|South Africa": [
    { minute: 9, team: { name: "Mexico" }, scorer: { name: "Julián Quiñones" }, assist: { name: "Érik Lira" }, type: "REGULAR" },
    { minute: 67, team: { name: "Mexico" }, scorer: { name: "Raúl Jiménez" }, assist: { name: "R. Alvarado" }, type: "REGULAR" },
  ],
  "South Korea|Czechia": [
    { minute: 59, team: { name: "Czechia" }, scorer: { name: "Ladislav Krejčí" }, assist: { name: "V. Coufal" }, type: "REGULAR" },
    { minute: 67, team: { name: "South Korea" }, scorer: { name: "Hwang In-beom" }, assist: { name: "Lee Kang-in" }, type: "REGULAR" },
    { minute: 80, team: { name: "South Korea" }, scorer: { name: "Oh Hyeon-gyu" }, assist: { name: "Hwang In-beom" }, type: "REGULAR" },
  ],
  "Czechia|South Africa": [
    { minute: 26, team: { name: "Czechia" }, scorer: { name: "Michal Sadílek" }, assist: null, type: "REGULAR" },
    { minute: 61, team: { name: "South Africa" }, scorer: { name: "Teboho Mokoena" }, assist: null, type: "PENALTY" },
  ],
  "Mexico|South Korea": [
    { minute: 50, team: { name: "Mexico" }, scorer: { name: "Luis Romo" }, assist: null, type: "REGULAR" },
  ],
  "Czechia|Mexico": [
    { minute: 12, team: { name: "Mexico" }, scorer: { name: "Mateo Chávez" }, assist: null, type: "REGULAR" },
    { minute: 44, team: { name: "Mexico" }, scorer: { name: "Álvaro Fidalgo" }, assist: null, type: "REGULAR" },
    { minute: 78, team: { name: "Mexico" }, scorer: { name: "Julián Quiñones" }, assist: null, type: "REGULAR" },
  ],
  "South Africa|South Korea": [
    { minute: 38, team: { name: "South Africa" }, scorer: { name: "Thapelo Maseko" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP B ======
  "Canada|Bosnia and Herzegovina": [
    { minute: 24, team: { name: "Bosnia and Herzegovina" }, scorer: { name: "Jovo Lukić" }, assist: null, type: "REGULAR" },
    { minute: 78, team: { name: "Canada" }, scorer: { name: "Cyle Larin" }, assist: null, type: "REGULAR" },
  ],
  "Qatar|Switzerland": [
    { minute: 44, team: { name: "Switzerland" }, scorer: { name: "Breel Embolo" }, assist: null, type: "PENALTY" },
    { minute: 90, team: { name: "Qatar" }, scorer: { name: "Boualem Khoukhi" }, assist: null, type: "REGULAR" },
  ],
  "Switzerland|Bosnia and Herzegovina": [
    { minute: 74, team: { name: "Switzerland" }, scorer: { name: "Johan Manzambi" }, assist: null, type: "REGULAR" },
    { minute: 82, team: { name: "Switzerland" }, scorer: { name: "Ruben Vargas" }, assist: null, type: "REGULAR" },
    { minute: 84, team: { name: "Switzerland" }, scorer: { name: "Johan Manzambi" }, assist: null, type: "REGULAR" },
    { minute: 86, team: { name: "Bosnia and Herzegovina" }, scorer: { name: "Ermin Mahmić" }, assist: null, type: "REGULAR" },
    { minute: 90, team: { name: "Switzerland" }, scorer: { name: "Granit Xhaka" }, assist: null, type: "PENALTY" },
  ],
  "Canada|Qatar": [
    { minute: 15, team: { name: "Canada" }, scorer: { name: "Jonathan David" }, assist: null, type: "REGULAR" },
    { minute: 32, team: { name: "Canada" }, scorer: { name: "Cyle Larin" }, assist: null, type: "REGULAR" },
    { minute: 44, team: { name: "Canada" }, scorer: { name: "Nathan Saliba" }, assist: null, type: "REGULAR" },
    { minute: 48, team: { name: "Canada" }, scorer: { name: "Jonathan David" }, assist: null, type: "REGULAR" },
    { minute: 65, team: { name: "Canada" }, scorer: { name: "Promise David" }, assist: null, type: "REGULAR" },
    { minute: 78, team: { name: "Canada" }, scorer: { name: "Jonathan David" }, assist: null, type: "PENALTY" },
  ],
  "Switzerland|Canada": [
    { minute: 38, team: { name: "Canada" }, scorer: { name: "Promise David" }, assist: null, type: "REGULAR" },
    { minute: 54, team: { name: "Switzerland" }, scorer: { name: "Johan Manzambi" }, assist: null, type: "REGULAR" },
    { minute: 72, team: { name: "Switzerland" }, scorer: { name: "Ruben Vargas" }, assist: null, type: "REGULAR" },
  ],
  "Bosnia and Herzegovina|Qatar": [
    { minute: 22, team: { name: "Bosnia and Herzegovina" }, scorer: { name: "Ermin Mahmić" }, assist: null, type: "REGULAR" },
    { minute: 51, team: { name: "Qatar" }, scorer: { name: "Hasan Al-Haydos" }, assist: null, type: "REGULAR" },
    { minute: 63, team: { name: "Bosnia and Herzegovina" }, scorer: { name: "Kerim Alajbegović" }, assist: null, type: "REGULAR" },
    { minute: 82, team: { name: "Bosnia and Herzegovina" }, scorer: { name: "Ermin Mahmić" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP C ======
  "Brazil|Morocco": [
    { minute: 21, team: { name: "Morocco" }, scorer: { name: "Ismael Saibari" }, assist: { name: "Brahim Díaz" }, type: "REGULAR" },
    { minute: 32, team: { name: "Brazil" }, scorer: { name: "Vinícius Júnior" }, assist: { name: "Bruno Guimarães" }, type: "REGULAR" },
  ],
  "Haiti|Scotland": [
    { minute: 62, team: { name: "Scotland" }, scorer: { name: "John McGinn" }, assist: null, type: "REGULAR" },
  ],
  "Scotland|Morocco": [
    { minute: 24, team: { name: "Morocco" }, scorer: { name: "Ismael Saibari" }, assist: null, type: "REGULAR" },
  ],
  "Brazil|Haiti": [
    { minute: 8, team: { name: "Brazil" }, scorer: { name: "Matheus Cunha" }, assist: null, type: "REGULAR" },
    { minute: 34, team: { name: "Brazil" }, scorer: { name: "Matheus Cunha" }, assist: null, type: "REGULAR" },
    { minute: 42, team: { name: "Brazil" }, scorer: { name: "Vinícius Júnior" }, assist: null, type: "REGULAR" },
  ],
  "Scotland|Brazil": [
    { minute: 23, team: { name: "Brazil" }, scorer: { name: "Matheus Cunha" }, assist: null, type: "REGULAR" },
    { minute: 55, team: { name: "Brazil" }, scorer: { name: "Vinícius Júnior" }, assist: null, type: "REGULAR" },
    { minute: 71, team: { name: "Brazil" }, scorer: { name: "Rodrygo" }, assist: null, type: "REGULAR" },
  ],
  "Morocco|Haiti": [
    { minute: 14, team: { name: "Haiti" }, scorer: { name: "Wilson Isidor" }, assist: null, type: "REGULAR" },
    { minute: 31, team: { name: "Morocco" }, scorer: { name: "Achraf Hakimi" }, assist: null, type: "REGULAR" },
    { minute: 48, team: { name: "Haiti" }, scorer: { name: "Wilson Isidor" }, assist: null, type: "REGULAR" },
    { minute: 56, team: { name: "Morocco" }, scorer: { name: "Soufiane Rahimi" }, assist: null, type: "REGULAR" },
    { minute: 71, team: { name: "Morocco" }, scorer: { name: "Gessime Yassine" }, assist: null, type: "REGULAR" },
    { minute: 87, team: { name: "Morocco" }, scorer: { name: "Ismael Saibari" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP D ======
  "United States|Paraguay": [
    { minute: 7, team: { name: "Paraguay" }, scorer: { name: "Mauricio" }, assist: null, type: "OWN_GOAL" },
    { minute: 19, team: { name: "United States" }, scorer: { name: "Folarin Balogun" }, assist: null, type: "REGULAR" },
    { minute: 27, team: { name: "United States" }, scorer: { name: "Folarin Balogun" }, assist: null, type: "REGULAR" },
    { minute: 56, team: { name: "Paraguay" }, scorer: { name: "Mauricio" }, assist: null, type: "REGULAR" },
    { minute: 79, team: { name: "United States" }, scorer: { name: "Gio Reyna" }, assist: null, type: "REGULAR" },
  ],
  "Australia|Türkiye": [
    { minute: 41, team: { name: "Australia" }, scorer: { name: "Nestory Irankunda" }, assist: null, type: "REGULAR" },
    { minute: 72, team: { name: "Australia" }, scorer: { name: "Connor Metcalfe" }, assist: null, type: "REGULAR" },
  ],
  "United States|Australia": [
    { minute: 31, team: { name: "Australia" }, scorer: { name: "Cameron Burgess" }, assist: null, type: "OWN_GOAL" },
    { minute: 58, team: { name: "United States" }, scorer: { name: "Alex Freeman" }, assist: null, type: "REGULAR" },
  ],
  "Türkiye|Paraguay": [
    { minute: 2, team: { name: "Paraguay" }, scorer: { name: "Matías Galarza" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP E ======
  "Germany|Curaçao": [
    { minute: 6, team: { name: "Germany" }, scorer: { name: "Felix Nmecha" }, assist: null, type: "REGULAR" },
    { minute: 21, team: { name: "Curaçao" }, scorer: { name: "Livano Comenencia" }, assist: null, type: "REGULAR" },
    { minute: 28, team: { name: "Germany" }, scorer: { name: "Kai Havertz" }, assist: null, type: "REGULAR" },
    { minute: 34, team: { name: "Germany" }, scorer: { name: "Jamal Musiala" }, assist: null, type: "REGULAR" },
    { minute: 41, team: { name: "Germany" }, scorer: { name: "Kai Havertz" }, assist: null, type: "REGULAR" },
    { minute: 56, team: { name: "Germany" }, scorer: { name: "Nathaniel Brown" }, assist: null, type: "REGULAR" },
    { minute: 67, team: { name: "Germany" }, scorer: { name: "Nico Schlotterbeck" }, assist: null, type: "REGULAR" },
    { minute: 82, team: { name: "Germany" }, scorer: { name: "Florian Wirtz" }, assist: null, type: "REGULAR" },
  ],
  "Ivory Coast|Ecuador": [
    { minute: 89, team: { name: "Ivory Coast" }, scorer: { name: "Franck Kessié" }, assist: null, type: "REGULAR" },
  ],
  "Germany|Ivory Coast": [
    { minute: 61, team: { name: "Ivory Coast" }, scorer: { name: "Franck Kessié" }, assist: null, type: "REGULAR" },
    { minute: 74, team: { name: "Germany" }, scorer: { name: "Deniz Undav" }, assist: null, type: "REGULAR" },
    { minute: 90, team: { name: "Germany" }, scorer: { name: "Deniz Undav" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP F ======
  "Netherlands|Japan": [
    { minute: 8, team: { name: "Netherlands" }, scorer: { name: "Virgil van Dijk" }, assist: null, type: "REGULAR" },
    { minute: 34, team: { name: "Japan" }, scorer: { name: "Keito Nakamura" }, assist: null, type: "REGULAR" },
    { minute: 52, team: { name: "Netherlands" }, scorer: { name: "Crysencio Summerville" }, assist: null, type: "REGULAR" },
    { minute: 89, team: { name: "Japan" }, scorer: { name: "Daichi Kamada" }, assist: null, type: "REGULAR" },
  ],
  "Sweden|Tunisia": [
    { minute: 14, team: { name: "Sweden" }, scorer: { name: "Yasin Ayari" }, assist: null, type: "REGULAR" },
    { minute: 35, team: { name: "Sweden" }, scorer: { name: "Alexander Isak" }, assist: null, type: "REGULAR" },
    { minute: 44, team: { name: "Sweden" }, scorer: { name: "Viktor Gyökeres" }, assist: null, type: "REGULAR" },
    { minute: 61, team: { name: "Tunisia" }, scorer: { name: "E. Ashour" }, assist: null, type: "REGULAR" },
    { minute: 68, team: { name: "Sweden" }, scorer: { name: "Mattias Svanberg" }, assist: null, type: "REGULAR" },
    { minute: 84, team: { name: "Sweden" }, scorer: { name: "Yasin Ayari" }, assist: null, type: "REGULAR" },
  ],
  "Netherlands|Sweden": [
    { minute: 12, team: { name: "Netherlands" }, scorer: { name: "Brian Brobbey" }, assist: null, type: "REGULAR" },
    { minute: 37, team: { name: "Netherlands" }, scorer: { name: "Cody Gakpo" }, assist: null, type: "REGULAR" },
    { minute: 52, team: { name: "Netherlands" }, scorer: { name: "Brian Brobbey" }, assist: null, type: "REGULAR" },
    { minute: 65, team: { name: "Sweden" }, scorer: { name: "Anthony Elanga" }, assist: null, type: "REGULAR" },
    { minute: 78, team: { name: "Netherlands" }, scorer: { name: "Cody Gakpo" }, assist: null, type: "REGULAR" },
    { minute: 89, team: { name: "Netherlands" }, scorer: { name: "Crysencio Summerville" }, assist: null, type: "REGULAR" },
  ],
  "Japan|Tunisia": [
    { minute: 18, team: { name: "Japan" }, scorer: { name: "Ayase Ueda" }, assist: null, type: "REGULAR" },
    { minute: 42, team: { name: "Japan" }, scorer: { name: "Daichi Kamada" }, assist: null, type: "REGULAR" },
    { minute: 67, team: { name: "Japan" }, scorer: { name: "Junya Ito" }, assist: null, type: "REGULAR" },
    { minute: 84, team: { name: "Japan" }, scorer: { name: "Ayase Ueda" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP G ======
  "Belgium|Egypt": [
    { minute: 32, team: { name: "Egypt" }, scorer: { name: "Emam Ashour" }, assist: null, type: "REGULAR" },
    { minute: 67, team: { name: "Egypt" }, scorer: { name: "Mohamed Hany" }, assist: null, type: "OWN_GOAL" },
  ],
  "Iran|New Zealand": [
    { minute: 8, team: { name: "New Zealand" }, scorer: { name: "Elijah Just" }, assist: null, type: "REGULAR" },
    { minute: 38, team: { name: "Iran" }, scorer: { name: "Ramin Rezaeian" }, assist: null, type: "REGULAR" },
    { minute: 55, team: { name: "New Zealand" }, scorer: { name: "Elijah Just" }, assist: null, type: "REGULAR" },
    { minute: 79, team: { name: "Iran" }, scorer: { name: "Mohammad Mohebi" }, assist: null, type: "REGULAR" },
  ],
  "New Zealand|Egypt": [
    { minute: 22, team: { name: "New Zealand" }, scorer: { name: "Finn Surman" }, assist: null, type: "REGULAR" },
    { minute: 41, team: { name: "Egypt" }, scorer: { name: "Mostafa Ziko" }, assist: null, type: "REGULAR" },
    { minute: 59, team: { name: "Egypt" }, scorer: { name: "Mohamed Salah" }, assist: null, type: "REGULAR" },
    { minute: 85, team: { name: "Egypt" }, scorer: { name: "Trezeguet" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP H ======
  "Saudi Arabia|Uruguay": [
    { minute: 44, team: { name: "Saudi Arabia" }, scorer: { name: "Abdulelah Al-Amri" }, assist: null, type: "REGULAR" },
    { minute: 80, team: { name: "Uruguay" }, scorer: { name: "Maximiliano Araújo" }, assist: null, type: "REGULAR" },
  ],
  "Spain|Saudi Arabia": [
    { minute: 15, team: { name: "Spain" }, scorer: { name: "Mikel Oyarzabal" }, assist: null, type: "REGULAR" },
    { minute: 38, team: { name: "Spain" }, scorer: { name: "Mikel Oyarzabal" }, assist: null, type: "REGULAR" },
    { minute: 59, team: { name: "Spain" }, scorer: { name: "Lamine Yamal" }, assist: null, type: "REGULAR" },
    { minute: 76, team: { name: "Spain" }, scorer: { name: "Álvaro Morata" }, assist: null, type: "REGULAR" },
  ],
  "Uruguay|Cape Verde": [
    { minute: 14, team: { name: "Cape Verde" }, scorer: { name: "Kevin Pina" }, assist: null, type: "REGULAR" },
    { minute: 48, team: { name: "Uruguay" }, scorer: { name: "Maximiliano Araújo" }, assist: null, type: "REGULAR" },
    { minute: 65, team: { name: "Cape Verde" }, scorer: { name: "Hélio Varela" }, assist: null, type: "REGULAR" },
    { minute: 82, team: { name: "Uruguay" }, scorer: { name: "Agustín Canobbio" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP I ======
  "France|Senegal": [
    { minute: 17, team: { name: "France" }, scorer: { name: "Kylian Mbappé" }, assist: null, type: "REGULAR" },
    { minute: 54, team: { name: "Senegal" }, scorer: { name: "Ibrahim Mbaye" }, assist: null, type: "REGULAR" },
    { minute: 62, team: { name: "France" }, scorer: { name: "Kylian Mbappé" }, assist: null, type: "REGULAR" },
    { minute: 78, team: { name: "France" }, scorer: { name: "Bradley Barcola" }, assist: null, type: "REGULAR" },
  ],
  "Iraq|Norway": [
    { minute: 14, team: { name: "Norway" }, scorer: { name: "Erling Haaland" }, assist: null, type: "REGULAR" },
    { minute: 28, team: { name: "Norway" }, scorer: { name: "Leo Østigård" }, assist: null, type: "REGULAR" },
    { minute: 36, team: { name: "Iraq" }, scorer: { name: "Aymen Hussein" }, assist: null, type: "REGULAR" },
    { minute: 52, team: { name: "Norway" }, scorer: { name: "Erling Haaland" }, assist: null, type: "REGULAR" },
    { minute: 71, team: { name: "Norway" }, scorer: { name: "Marcus Holmgren Pedersen" }, assist: null, type: "REGULAR" },
  ],
  "France|Iraq": [
    { minute: 22, team: { name: "France" }, scorer: { name: "Ousmane Dembélé" }, assist: null, type: "REGULAR" },
    { minute: 44, team: { name: "France" }, scorer: { name: "Kylian Mbappé" }, assist: null, type: "REGULAR" },
    { minute: 72, team: { name: "France" }, scorer: { name: "Kylian Mbappé" }, assist: null, type: "PENALTY" },
  ],
  "Norway|Senegal": [
    { minute: 6, team: { name: "Norway" }, scorer: { name: "Erling Haaland" }, assist: null, type: "REGULAR" },
    { minute: 34, team: { name: "Norway" }, scorer: { name: "Marcus Holmgren Pedersen" }, assist: null, type: "REGULAR" },
    { minute: 48, team: { name: "Senegal" }, scorer: { name: "Ismaïla Sarr" }, assist: null, type: "REGULAR" },
    { minute: 57, team: { name: "Norway" }, scorer: { name: "Erling Haaland" }, assist: null, type: "REGULAR" },
    { minute: 82, team: { name: "Senegal" }, scorer: { name: "Ismaïla Sarr" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP J ======
  "Argentina|Algeria": [
    { minute: 24, team: { name: "Argentina" }, scorer: { name: "Lionel Messi" }, assist: null, type: "REGULAR" },
    { minute: 51, team: { name: "Argentina" }, scorer: { name: "Lionel Messi" }, assist: null, type: "REGULAR" },
    { minute: 74, team: { name: "Argentina" }, scorer: { name: "Lionel Messi" }, assist: null, type: "REGULAR" },
  ],
  "Austria|Jordan": [
    { minute: 18, team: { name: "Austria" }, scorer: { name: "Romano Schmid" }, assist: null, type: "REGULAR" },
    { minute: 41, team: { name: "Jordan" }, scorer: { name: "Ali Olwan" }, assist: null, type: "REGULAR" },
    { minute: 62, team: { name: "Austria" }, scorer: { name: "Marko Arnautović" }, assist: null, type: "REGULAR" },
    { minute: 79, team: { name: "Austria" }, scorer: { name: "Marcel Sabitzer" }, assist: null, type: "REGULAR" },
  ],
  "Argentina|Austria": [
    { minute: 36, team: { name: "Argentina" }, scorer: { name: "Lionel Messi" }, assist: null, type: "REGULAR" },
    { minute: 68, team: { name: "Argentina" }, scorer: { name: "Lionel Messi" }, assist: null, type: "REGULAR" },
  ],
  "Algeria|Jordan": [
    { minute: 44, team: { name: "Jordan" }, scorer: { name: "Nizar Al-Rashdan" }, assist: null, type: "REGULAR" },
    { minute: 63, team: { name: "Algeria" }, scorer: { name: "Nadir Benbouhali" }, assist: null, type: "REGULAR" },
    { minute: 86, team: { name: "Algeria" }, scorer: { name: "Amine Gouiri" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP K ======
  "Portugal|DR Congo": [
    { minute: 6, team: { name: "Portugal" }, scorer: { name: "João Neves" }, assist: null, type: "REGULAR" },
    { minute: 45, team: { name: "DR Congo" }, scorer: { name: "Yoane Wissa" }, assist: null, type: "REGULAR" },
  ],
  "Uzbekistan|Colombia": [
    { minute: 28, team: { name: "Colombia" }, scorer: { name: "Luis Díaz" }, assist: null, type: "REGULAR" },
    { minute: 44, team: { name: "Uzbekistan" }, scorer: { name: "Abbosbek Fayzullaev" }, assist: null, type: "REGULAR" },
    { minute: 56, team: { name: "Colombia" }, scorer: { name: "Daniel Muñoz" }, assist: null, type: "REGULAR" },
    { minute: 81, team: { name: "Colombia" }, scorer: { name: "Jaminton Campaz" }, assist: null, type: "REGULAR" },
  ],
  "Portugal|Uzbekistan": [
    { minute: 14, team: { name: "Portugal" }, scorer: { name: "Nuno Mendes" }, assist: null, type: "REGULAR" },
    { minute: 32, team: { name: "Portugal" }, scorer: { name: "Cristiano Ronaldo" }, assist: null, type: "REGULAR" },
    { minute: 44, team: { name: "Uzbekistan" }, scorer: { name: "Abduvohid Nematov" }, assist: null, type: "OWN_GOAL" },
    { minute: 59, team: { name: "Portugal" }, scorer: { name: "Cristiano Ronaldo" }, assist: null, type: "REGULAR" },
    { minute: 78, team: { name: "Portugal" }, scorer: { name: "Rafael Leão" }, assist: null, type: "REGULAR" },
  ],
  "Colombia|DR Congo": [
    { minute: 42, team: { name: "Colombia" }, scorer: { name: "Daniel Muñoz" }, assist: null, type: "REGULAR" },
  ],

  // ====== GROUP L ======
  "England|Croatia": [
    { minute: 12, team: { name: "England" }, scorer: { name: "Harry Kane" }, assist: null, type: "PENALTY" },
    { minute: 36, team: { name: "Croatia" }, scorer: { name: "Martin Baturina" }, assist: { name: "Petar Sučić" }, type: "REGULAR" },
    { minute: 42, team: { name: "England" }, scorer: { name: "Harry Kane" }, assist: { name: "Declan Rice" }, type: "REGULAR" },
    { minute: 45, team: { name: "Croatia" }, scorer: { name: "Petar Musa" }, assist: { name: "Ivan Perišić" }, type: "REGULAR" },
    { minute: 47, team: { name: "England" }, scorer: { name: "Jude Bellingham" }, assist: { name: "Elliot Anderson" }, type: "REGULAR" },
    { minute: 85, team: { name: "England" }, scorer: { name: "Marcus Rashford" }, assist: { name: "Bukayo Saka" }, type: "REGULAR" },
  ],
  "Ghana|Panama": [
    { minute: 90, team: { name: "Ghana" }, scorer: { name: "Caleb Yirenkyi" }, assist: null, type: "REGULAR" },
  ],
  "Panama|Croatia": [
    { minute: 54, team: { name: "Croatia" }, scorer: { name: "Ante Budimir" }, assist: null, type: "REGULAR" },
  ],

  // 0-0 matches (no goals)
  // "Ecuador|Curaçao": [], "Belgium|Iran": [], "Spain|Cape Verde": [], "England|Ghana": []
};

// 去重统计
const keys = Object.keys(DATA);
let totalGoals = 0;
keys.forEach(k => { totalGoals += DATA[k].length; });

writeFileSync(join(__dirname, "goals.json"), JSON.stringify(DATA, null, 2));
console.log(`✅ goals.json: ${keys.length} 场比赛, ${totalGoals} 粒进球`);
console.log(`   数据来源: footballtransfers.com + football-iq.app + worldcuppass.com + sportsmole.co.uk`);
