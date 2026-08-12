class Perso {
  constructor(x, y, angle, user) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.v = 3;
    this.bullets = [];
    this.hp = 100;
    this.left = false;
    this.right = false;
    this.top = false;
    this.bottom = false;
    this.angleTir = 0;
    this.user = user;
    this.score = 0;
    this.mag = 30;
    this.reloadTime = 300;  // 5 sec de rechargement (duree du son de rechargement ) 300/60
    this.reloading = false;
    this.width = 20;
    this.height = 20;
    this.haveBonus = [];

  }
  // -------- *********************** --------//
  drawBullets(ctx) {
    ctx.save();
    for (let i = 0; i < this.bullets.length; i++) {
      let b = this.bullets[i];
      b.draw(ctx);
      b.move();
      if ((b.cWidth / 4 * 1.1 < 0) || (b.cHeight / 4 * 1.1 < 0) || (b.x > canvas.width) || (b.y > canvas.height))
      {
        this.removeBullet(b)
      }
    }
    ctx.restore();
  }

// -------- Retire les balles  --------//
  removeBullet(bullet) {
    let position = this.bullets.indexOf(bullet);
    this.bullets.splice(position, 1);
  }

  // -------- Dessine l'angle pour debug --------//
  drawAngle(ctx,mousepos) {
    ctx.save();
    // pour debug angle, on dessine une ligne qui part du perso et qui va vers la souris,
    // en fonction de l'angle
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    let xd = this.x + Math.cos(this.angleTir+Math.PI) * 100;
    let yd = this.y + Math.sin(-this.angleTir ) * 100;
    ctx.lineTo(xd, yd);
    ctx.stroke();
    ctx.fillStyle = "red";
    ctx.restore();
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.rotate(Math.PI);
    ctx.rotate(this.angleTir);
    ctx.fillStyle = "red";
    ctx.drawImage(this.user, -10, -15, 50, 50);
    ctx.restore();

    this.drawBullets(ctx);
    this.reload();
    if (this.reloading == true)
    {
        this.reloadTime--;
    }
  }
  // -------- Chargement  --------//
  reload()
  {
      if(this.manualReload && this.mag < 30 && this.reloading == false)
      {
          console.log('je recharge');
          this.reloading = true;
          var sonreload = new sound('sound_src/reload.mp3');
          sonreload.play();
      }else if(this.mag <= 0 && this.reloading == false)
      {
          this.reloading = true;
          var sonreload = new sound('sound_src/reload.mp3');
          sonreload.play();
      }
      if(this.reloading && this.reloadTime == 0)
      {
          this.reloading = false;
          this.reloadTime = 300;
          this.manualReload = false;
          this.mag = 30;
      }
  }
  // -------- Calcule de l'angle --------//
  calculeAngle(mousepos)
  {
    let dx = this.x+cWidth/4 - mousepos.x;
    let dy = this.y+cHeight/4 - mousepos.y;
    this.angleTir = Math.atan2(dy, dx);
  }
  fire(mousepos)
  {
    if(this.mag > 0)
    {
        var sontirer = new sound('sound_src/shoot.mp3');
        // 2) On dÃ©place la balle
        let dx = this.x+cWidth/4 - mousepos.x;
        let dy = this.y+cHeight/4 - mousepos.y;
        this.angleTir = Math.atan2(dy, dx);
        this.bullets.push(new Bullet(this.x, this.y, this.angleTir,balle));
        sontirer.volume(0.4);
        sontirer.play();
        this.mag--;
        if (this.mag <= 0)
        {
            this.mag = 0;
        }
    }
}
 explosion(boostBox){
   let a = 4 + (boostBox.level*2);
    for (let i = 0; i < a; i++) {
      this.bullets.push(new Bullet(this.x, this.y, i*Math.PI/(a/2),balle));
      
    }
 }


  // -------- Déplace le pesonnage -------- //
  move()
  {
    if(this.top)
    {
      this.y -= this.v;
      if(this.y <= murTopLeft.y + murTopLeft.height || this.y <= murTopRight.y + murTopLeft.height){
        this.y +=this.v;
      }
    }
    if(this.right)
    {
      this.x += this.v;
      if(this.x  + 20 >= murRightTop.x || this.x  + 20 >= murRightBot){
        this.x -=this.v;
      }
    }
    if(this.bottom)
      {
        this.y += this.v;
        if(this.y + 20 >= murBotLeft.y || this.y + 20 >= murBotRight.y){
          this.y -=this.v;
        }
      }
    if(this.left)
    {
      this.x -= this.v;
      if(this.x <= murLeftTop.x + murLeftTop.width || this.x <= murLeftBot.x + murLeftBot.width){
        this.x += this.v;
      }
    }
  }

  checkInside() // rend true si il est dans le bunker;
  {
    if (this.x >= cWidth/4 && this.x <= this.v * (cWidth/4) - 20 && this.y >= cHeight/4 && this.y <= this.v * (cHeight/4) - 20){
      // console.log("je suis dedans");
      return true;
    }else {
      // console.log("je suis dehors");
      return false;
    }
  }

  // -------- Check tous les bonus du perso  --------//
  checkHaveBonus()
  {
    context.save();
    context.translate(this.x+cWidth/4,this.y+cHeight/4);
    this.haveBonus.forEach(bonus => {
      if(bonus.idBonus == 2)
      {
        let img = new Image();
        img.src = "https://mobilegamegraphics.com/pvpaterno/pixelantasy/character_shield.gif";
        context.drawImage(img, -20, -20, 50, 50);
        this.hp = 100;
        if(bonus.timer <= 0)
          this.haveBonus.splice(this.haveBonus.indexOf(bonus),1);

        bonus.timer -= 1;
      }
    });
    context.restore();
  }


  //---------- HIT BULLET DELETE ------------ //
  hitBullet(zombies)
  {
    let idx;
    p.bullets.forEach(b => {
      zombies.forEach(z => {
        if(b.x +cWidth/4> z.x && b.x + cWidth/4< z.x+20 && b.y +cHeight/4> z.y && b.y  + cHeight/4< z.y+20)
        {
          idx = zombies.indexOf(z);
          zombies.splice(idx,1);
          this.removeBullet(b);
          this.score += 1;
        }
      })
    });

  }

}
