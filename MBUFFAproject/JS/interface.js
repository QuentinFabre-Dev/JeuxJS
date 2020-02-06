class UI
{
    static DrawVie(ctx,image,vie)
    {
        ctx.save();
        ctx.fillStyle = "lightgrey";
        ctx.fillRect(60,15, 200, 20);
        ctx.fillStyle = "red";
        if(vie <= 0)
            ctx.fillRect(60,15,0, 20);
        ctx.fillRect(60,15, vie*2, 20);
        ctx.drawImage(image, 20, 10,30,30);
        ctx.restore();
    }
    // -------- Dessine le temps  --------//
    static drawTime()
    {
        context.font = "14pt Arial Black";
        context.fillStyle = "black";
        context.strokeStyle = "black";
        context.fillText(Horde.displayTitle(), (cWidth/2)- 30,30);
    }

    // -------- Dessine le score  --------//
    static drawScore(perso)
    {
        context.font = "14pt Arial Black";
        context.fillStyle = "black";
        context.strokeStyle = "black";
        context.fillText("Score : "+perso.score, cWidth-250,30);
    }

    // -------- Dessine le chargeur  --------//
    static drawMag(perso)
    {

        context.font = "14pt Arial Black";
        context.fillStyle = 'rgb(0,'+(180-perso.reloadTime)+',0)';
        context.strokeStyle = "yellow";
        context.fillText("Chargeur : "+perso.mag, cWidth - 180,cHeight - 30);
    }

}
