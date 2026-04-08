class Bonus
{     
    constructor(idBonus)
    {
        this.x = Tools.getRandomInt(0,cWidth/4);
        this.y = Tools.getRandomInt(0,cHeight/4);
        this.idBonus = idBonus;
        this.timer = 360;
        this.bonus = [];
        this.width = 50;
        this.height = 50;
    }

    // -------- Dessine les bonus sur la carte  --------//
    drawBonus(ctx)
    {
        ctx.save();
        ctx.translate(cWidth/4, cHeight/4);
        ctx.fillStyle = "blue";
        // ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
        ctx.restore();
    }

    // -------- Check si un bonus de vie a été récupérer  --------//
    checkBonus(p,boostBox)
    {
        if(Tools.checkCollision(p,this))
        {
            if(p.hp < 100){
                p.hp +=10;
            }
            if(p.mag < 30){
                p.mag += 2;
            }
            p.explosion(chest,boostBox);
            return true;
        }

    }

    // -------- Fait spawn un Bonus de Vie sur la carte  --------//
    static spawnBonusVie()
    {
        setInterval(()=>{
            let b1 = new Bonus(1);  
            b1.img = new Image();
            b1.img.src = "https://cdn.pixilart.com/photos/orginal/e7bb9b4d00a2a4f.gif";
            bonus.push(b1);
          },10000);
    }

    // -------- Fait spawn un Bonus Shield sur la carte  --------//
    static spawnBonusShield()
    {
        setInterval(()=>{
            let b1 = new Bonus(2);  
            b1.img = new Image();
            b1.img.src = "https://mobilegamegraphics.com/pvpaterno/pixelantasy/character_shield.gif";
            bonus.push(b1);
          },16000);
    }

}
