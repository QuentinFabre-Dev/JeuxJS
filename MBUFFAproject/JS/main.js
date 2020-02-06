window.onload = init;
window.addEventListener('keydown', handleKeydown, false);
window.addEventListener('keyup', handleKeyup, false);
window.addEventListener('click', handleClick, false);

var a = 5;

var murs = [];
var portes = [];
var dalles = [];
var bullets = [];
var bonus = [];
var canvas, context,cHeight,cWidth;

// -------- Appeler au lancement de la page --------//
function init() {
  canvas = document.querySelector("#Canvas");
  context = canvas.getContext("2d");
  cHeight = canvas.height;
  cWidth = canvas.width;
  canvas.addEventListener('mousemove', function (evt) {
    mousepos = getMousePos(canvas, evt);
    p.calculeAngle(mousepos);
}, false);
image = document.getElementById("source");
user = document.getElementById("user");
balle = document.getElementById("balle");
impact = document.getElementById("impact");
imgZombie = document.getElementById("zombie");
chest = document.getElementById("chest");

Bonus.spawnBonusVie();
Bonus.spawnBonusShield();
// setInterval(()=>{
//   b1 = new Bonus(1);  
//   b1.img = new Image();
//   b1.img.src = "https://cdn.pixilart.com/photos/orginal/e7bb9b4d00a2a4f.gif";
//   bonus.push(b1);
// },10000);




  // --------Dessine les murs --------//
  drawMurs(murs,portes,dalles);

  // -------- Initialisation des Objets -------- //
  p = new Perso(0,0,12,user);
  Horde = new Wave(15);
  Horde.newwave();
  console.log(Horde.list);
  // bullets = new Bullet(30,30,1);


  // --------Animation 60FPS -------- //
  requestAnimationFrame(anime60fps);

}
function addB(){
  a++;
  bonus.push(new Bonus(a,chest));
  console.log("bonus.length");
}

// --------Evenement lors d'un click --------//
function handleClick(evt)
{
  p.fire(mousepos);
}

// --------Evenement lors d'un KeyDown --------//
function handleKeydown(evt)
{
    if(evt.keyCode == 90)
        p.top = true;
    if(evt.keyCode == 68)
        p.right = true;
    if(evt.keyCode == 83)
        p.bottom = true;
    if(evt.keyCode == 81)
        p.left = true;
    if(evt.keyCode == 82)
        p.manualReload = true;
    if(evt.keyCode == 69 && Tools.checkCollision(chest,p) && chest.price <= p.score){
      p.score -= chest.price;
      chest.price = parseInt(chest.price*1.2,10);
      p.v += 0.2;
      chest.level ++;
    }
}


// --------Evenement lors d'un KeyUp --------//
function handleKeyup(evt)
{
  if(evt.keyCode == 90)
    p.top = false;
  if(evt.keyCode == 68)
    p.right = false;
  if(evt.keyCode == 83)
    p.bottom = false;
  if(evt.keyCode == 81)
    p.left = false;
}

// -------- Fonction pour dessiner les murs du bunker --------//
function drawMurs(tabMurs, tabPortes, tabDalles)
{

  var tailleEntree = 40;
  // Coeff pour les murs haut et bas
  var coeffX = Tools.getCoeff(tailleEntree,cWidth);
  // Coeff pour les murs droite et gauche
  var coeffY = Tools.getCoeff(tailleEntree,cHeight);
  // top side
  murTopLeft = new Walls(0, 0, cWidth / coeffX, 1, "black", context);
  murTopRight = new Walls(murTopLeft.width + tailleEntree, 0, murTopLeft.width, 1, "black", context);

  // left side
  murLeftTop = new Walls(0, 0, 1, cHeight/coeffY, "black", context);
  murLeftBot = new Walls(0, murLeftTop.height + tailleEntree, 1, cHeight/coeffY, "black", context);
  // right side
  murRightTop = new Walls(murTopRight.x+ murTopRight.width, 0, 1, cHeight/coeffY, "black", context);
  murRightBot = new Walls(murRightTop.x, murRightTop.height+tailleEntree, 1, cHeight/coeffY, "black", context);
  // bot side
  murBotLeft = new Walls(0, murRightBot.y + murRightBot.height , cWidth/coeffX, 1, "black", context);
  murBotRight = new Walls(murBotLeft.width + tailleEntree, murRightBot.height + murRightBot.y, cWidth/coeffX, 1, "black", context);
  // Création des 4 portes
  westDoor = new Door(0,murLeftTop.height,3, tailleEntree,"black",context);
  eastDoor = new Door(murRightTop.x,murRightTop.height+murRightTop.y,3, tailleEntree,"grey",context);
  northDoor = new Door(murTopLeft.width,0,tailleEntree, 3,"yellow",context);
  southDoor = new Door(murTopLeft.width,murLeftBot.y+murLeftBot.height,tailleEntree, 3,"brown",context);
  // Création des 4 dalles *TODO*
  westSlab = new Slab("green",context,2,westDoor);
  northSlab = new Slab("green",context,2,northDoor);
  eastSlab = new Slab("green",context,2,eastDoor);
  southSlab = new Slab("green",context,2,southDoor);
  tabDalles.push(westSlab);
  tabDalles.push(northSlab);
  tabDalles.push(eastSlab);
  tabDalles.push(southSlab);

  tabPortes.push(eastDoor);
  tabPortes.push(westDoor);
  tabPortes.push(northDoor);
  tabPortes.push(southDoor);

  tabMurs.push(murTopLeft);
  tabMurs.push(murTopRight);
  tabMurs.push(murLeftTop);
  tabMurs.push(murLeftBot);
  tabMurs.push(murRightTop);
  tabMurs.push(murRightBot);
  tabMurs.push(murBotLeft);
  tabMurs.push(murBotRight);
  chest = new BoostBox(murTopRight.x + murTopRight.width/2, 10, 170,50,"red",context);
}

// -------- Retourne les valeurs X Y de la souris --------//
function getMousePos(canvas, evt) {
  // get canvas position
  var obj = canvas;
  var top = 0;
  var left = 0;
  while (obj && obj.tagName != 'BODY') {
      top += obj.offsetTop;
      left += obj.offsetLeft;
      obj = obj.offsetParent;
  }

  // return relative mouse position
  var mouseX = evt.clientX - left + window.pageXOffset;
  var mouseY = evt.clientY - top + window.pageYOffset;
  return {
      x: mouseX,
      y: mouseY
  }
}



// -------- Fonction répétée 60x par seconde -------- //
function anime60fps() {
      context.clearRect(0, 0, canvas.width, canvas.height);

      // -------- Murs --------//
      chest.draw();

      murs.forEach(function(element){
        element.draw();
      });

      // -------- Dalles --------//
      dalles.forEach(function(element){
        element.draw();
        if(element.checkCapacity(Horde.list) >= element.resistance && element.linkedDoor.passable == false){
          element.linkedDoor.switchState();
        }
      });
      // -------- Portes --------//
      portes.forEach(function(element){
        if(element.passable == false){
          element.draw();
        }
      });
      context.save();
      context.translate(cWidth/4,cHeight/4);
      p.draw(context);
      p.move();
      context.restore();

      // -------- Vague de Zombies --------//
      Horde.list.forEach(function(element){
        element.draw();
        element.move(p);
      });
      p.hitBullet(Horde.list);

    if(p.hp > 0){
      window.requestAnimationFrame(anime60fps);
    }else{
      context.font = "45pt Arial Black";
        context.fillStyle = "black";
        context.strokeStyle = "yellow";
        context.fillText("Perdu", cWidth/2, cHeight/2);
        context.strokeText("Perdu", cWidth/2, cHeight/2);
    }
    //PAS FINI

    // bonus.forEach(unBonus => {
    //   if(unBonus.timer <= 0 || unBonus.checkBonus(p)){
    //     bonus.splice(bonus.indexOf(unBonus),1);
    //   }else{
    //     unBonus.drawBonus(context);
    //     unBonus.timer -= 1;
    //   }
    // });

    // --------Check si un bonus a été récupéré  --------//

    p.checkHaveBonus();
    bonus.forEach(unBonus => {
      if(unBonus.timer <= 0)
        bonus.splice(bonus.indexOf(unBonus),1);
      if(unBonus.checkBonus(p,chest))
      {
        p.haveBonus.push(unBonus);
        bonus.splice(bonus.indexOf(unBonus),1);
      }

      else{
        unBonus.drawBonus(context);
        unBonus.timer -= 1;
      }
    });  //INTERFACE DE LA VIE
    UI.DrawVie(context,image,p.hp);
    UI.drawTime(context);
    UI.drawScore(p);
    UI.drawMag(p);
    if(Horde.list.length == 0){
        Tools.resetDoors(portes);
        Horde.newwave();
        console.log(Horde.list);
    }

}
