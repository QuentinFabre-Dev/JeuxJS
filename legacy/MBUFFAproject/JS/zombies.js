class Zombies{
    constructor(x, y,imgZombie) {
      this.x = x;
      this.y = y;
      this.slab = null;
      this.imgZombie = imgZombie;
      this.width = 20;
      this.height = 20;
    }

    draw()
    {
      context.save();
      context.fillStyle = "red";
      // context.fillRect(this.x, this.y, 20, 20);
      context.drawImage(this.imgZombie, this.x-15, this.y-15, 50, 50);
      context.restore();
    }
    wichSlab(tabSlab){
      let  closestSlab = null;
      let minDist = 10000000;
      tabSlab.forEach(slab => {
        var X = slab.x + cWidth/4;
        var Y = slab.y + cHeight/4;
        let distance = Math.sqrt(Math.pow(X - this.x,2) + Math.pow(Y-this.y,2));
        if(distance <= minDist){
          minDist = distance;
          closestSlab = slab;
        }
      });

      this.slab = closestSlab;
    }
    // -------- Déplace le pesonnage -------- //
    move(unPerso)
    {
        /* Parcourir les portes, chercher laquelle est la + proche,
        les faire avancer jusqu'à la porte en question */
        if(this.slab.linkedDoor.passable == false){

          if(this.x < this.slab.x + (cWidth/4)){
            this.x += 1;
            Horde.list.forEach(unzombi => {
              if(Object.is(this,unzombi) == false && Tools.checkCollision(unzombi,this)){
                this.x -=3;
                unzombi.x +=3;
              }
            });
          }else{
            this.x -= 1;
            Horde.list.forEach(unzombi => {
              if(Object.is(this,unzombi) == false && Tools.checkCollision(unzombi,this)){
                this.x +=3;
                unzombi.x -=3;
              }
            });
          }
          if(this.y <= this.slab.y + (cHeight/4)){
            this.y  += 1;
            Horde.list.forEach(unzombi => {
              if(Object.is(this,unzombi) == false && Tools.checkCollision(unzombi,this)){
                this.y -=3;
                unzombi.y +=3;
              }
            });
          }else{
            this.y -= 1;
            Horde.list.forEach(unzombi => {
              if(Object.is(this,unzombi) == false && Tools.checkCollision(unzombi,this)){
                this.y +=3;
                unzombi.y -=3;
              }
            });
          }
        }else{
          if(this.x < unPerso.x+cWidth/4){
            this.x += 1;
            Horde.list.forEach(unzombi => {
              if(Object.is(this,unzombi) == false && Tools.checkCollision(unzombi,this)){
                this.x -=3;
                unzombi.x +=3;
              }
            });
            if(Tools.charCollide(this)){
              this.x -= 30;
              unPerso.hp -=10;
            }
          }else{
            this.x -= 1;
            Horde.list.forEach(unzombi => {
              if(Object.is(this,unzombi) == false && Tools.checkCollision(unzombi,this)){
                this.x +=3;
                unzombi.x -=3;
              }
            });
            if(Tools.charCollide(this)){
              this.x += 30;
              unPerso.hp -=10;
            }
          }
          if(this.y <= unPerso.y+cHeight/4){
            this.y  += 1;
            Horde.list.forEach(unzombi => {
              if(Object.is(this,unzombi) == false && Tools.checkCollision(unzombi,this)){
                this.y -=3;
                unzombi.y +=3;
              }
            });
            if(Tools.charCollide(this)){
              this.y -= 30;
              unPerso.hp -=10;
            }
          }else{
            this.y -= 1;
            Horde.list.forEach(unzombi => {
              if(Object.is(this,unzombi) == false && Tools.checkCollision(unzombi,this)){
                this.y +=3;
                unzombi.y -=3;
              }
            });
            if(Tools.charCollide(this)){
              this.y += 30;
              unPerso.hp -=10;
            }
          }
        }
        /* Il faudra ajouter un test pour savoir si la porte reliée à la dalle est perméable*/
    }



}
