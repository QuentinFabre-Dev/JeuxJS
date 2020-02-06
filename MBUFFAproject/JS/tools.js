class Tools
 {
    static getCoeff(tailleOuvertures,sideWidth){
    /* fonction qui renvoi le coeff pour un tailleOuvertures souhaité
        En gros su tu veux une entree de taille = tailleOuvertures, il calcule un coeff.
        Tu divisive la taille du canvas (cWidth) par ça comme ça les murs qui
        composent un côté ont la bonne taille pour laisser une écart (du coup l'entree) souhaité
        @param 1 : taille de l'entree souhaitée
        @param 2 : side concerné (cWidth pour top et bot, cHeight pour left et right)
        --> Ca veut dire que toutes les ouvertures ont la même taille, à voir si ça convient à tlm
        */
    var rslt;
    rslt = sideWidth / ((sideWidth/2 - tailleOuvertures) /2);
    return rslt;
  }
  static getRndInt(min,max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  // Cette fonction permet de comparer UNIQUEMENT un perso et un zombie ou deux zombies entre eux
  static checkCollision(obj1, obj2){
    var test = false;
    if(obj1.x + obj1.width > obj2.x && obj1.x < obj2.x + obj2.width && obj1.y + obj1.height > obj2.y && obj1.y < obj2.y + obj2.height){
      test = true;
    }
    return test;
  }
  static addBonus(bonusList){
    bonusList.push(new Bonus(1,chest));
  }
  static charCollide(obj){
    var test = false;
    if(obj.x + obj.width > p.x + cWidth/4 && obj.x < p.x + 20 + cWidth/4 && obj.y + obj.height > p.y + cHeight/4 && obj.y < p.y + 20 + cHeight/4){
      test = true;
    }
    return test;
  }
  static rndPlacement(){
    let s1 = this.getRndInt(1,2);
    let pos = [];
    let x = 0;
    let y = 0;
      x = this.getRndInt(-100, cWidth+100);
      if(s1 == 1){
        y = this.getRndInt(-100,0);
      }else{
        y = this.getRndInt(cHeight, cHeight+100);
      }
    pos.push(x);
    pos.push(y);
    return pos;
  }
  static resetDoors(doorList){
    doorList.forEach(door => {
      door.switchState();
    });
  }
  static getRandomInt(min,max) {
    // return Math.floor(Math.random() * Math.floor(max));
    return Math.random() * (max - min) + min;
  }
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  static makecolor(r,g,b){
      return 'rgb('+r+', '+g+', '+b+')'
  }

}
