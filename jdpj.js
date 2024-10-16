// ==UserScript==
// @name         京东自动评价JS脚本
// @namespace    http://github.com/byhooi
// @version      1.0
// @description  在京东自动进行商品评价
// @match        https://club.jd.com/myJdcomments/myJdcomment.action
// @grant        none
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/refs/heads/master/jdpj.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/refs/heads/master/jdpj.js
// ==/UserScript==

(function() {
    'use strict';

    // 添加一个按钮到页面
    const startButton = document.createElement("button");
    startButton.innerHTML = "开始评价";
    startButton.style.position = "fixed";
    startButton.style.top = "10px";
    startButton.style.right = "10px";
    startButton.style.zIndex = "1000";
    startButton.style.padding = "10px";
    startButton.style.fontSize = "16px";
    startButton.style.backgroundColor = "#e2231a";
    startButton.style.color = "#FFFFFF";
    startButton.style.border = "none";
    startButton.style.cursor = "pointer";
    document.body.appendChild(startButton);

    // 评价脚本
    function startEvaluation() {
        document.body.innerHTML = "";
        $("html").css("overflow", "hidden");
        $("body").append('<div id="topTitle" style="padding:20px;display:block;font-size:48px;color:#FFFFFF;background-color:#e2231a;width:100%;text-align:center">京东自动评价JS脚本 by Clarkent V0.3</div><iframe src="https://club.jd.com/myJdcomments/myJdcomment.action?sort=0" style="width:99%;height:800px" id="JDifr"></iframe>');
        $("#J-global-toolbar").remove();

        let isFiveStar = true;
        $("#topTitle").click(function() {
            (isFiveStar = !isFiveStar) ? $("#topTitle").css("background-color", "#e2231a") : $("#topTitle").css("background-color", "#8B0000");
        });

        let pendingNum = 1;
        let waitSubmitIds;
        let curId = 0;
        let maxCurId = 0;

        $("#JDifr").load(function() {
            if ($("#JDifr").attr("src").indexOf("sort") > 0) {
                pendingNum = ($("#JDifr").contents().find("a.text:first").siblings().length > 0 && $("#JDifr").contents().find("a.text:first").attr("href") == "?sort=0") ? parseInt($("#JDifr").contents().find("a.text:first").next().text()) : 0;
                waitSubmitIds = $("#JDifr").contents().find(".number").length > 0 ? $("#JDifr").contents().find(".number").text().match(/\d{10,12}/g) : 0;
                maxCurId = waitSubmitIds ? waitSubmitIds.length : 0;
                curId = 0;
                if (pendingNum != 0 && maxCurId > 0) {
                    gotoNextURL("order");
                } else {
                    showInfo("订单全部评价完毕！！！");
                }
            } else if ($("#JDifr").attr("src").indexOf("ruleid") > 0 && curId < maxCurId) {
                sumbitEvaluate();
                gotoNextURL("order");
            } else if (curId == maxCurId) {
                gotoNextURL("main");
            } else {
                showInfo("异常了！联系作者！");
            }
            $("#JDifr").contents().find("html").css("overflow", "hidden");
        });

        function showInfo(infoShow) {
            $("#JDifr").contents().find("#nav").text(infoShow);
            $("#JDifr").contents().find("#nav").css({
                "text-align": "center",
                "padding": "30px",
                "margin": "1px",
                "font-size": "50px",
                "color": "#FFFFFF",
                "width": "100%"
            });
        }

        function gotoNextURL(nextURL) {
            let trueNextURL = (nextURL == "main") ? ("https://club.jd.com/myJdcomments/myJdcomment.action?sort=0") : ("https://club.jd.com/myJdcomments/orderVoucher.action?ruleid=" + waitSubmitIds[curId]);
            window.setTimeout(function() {
                $("#JDifr").attr("src", trueNextURL);
            }, 500);
        }

        function sumbitEvaluate() {
            if ($("#JDifr").attr("src").indexOf("club.jd.com") > 0) {
                let tempInter, contentArr = [
                    '商品质量超出预期，非常满意！配送速度快得惊人，配送员的服务态度更是让人感到温暖。',
                    '这个产品真的很实用，完全符合我的需求。京东的物流速度简直是神速，期待未来能更快~(✿◡‿◡)',
                    '京东的"多快好省"不是空话，每次购物都让我感到惊喜。这里已经成为我网购的首选了！',
                    '又是一次愉快的购物体验！价格实惠，快递迅速，京东的专业和贴心服务真的让人感动。',
                    '趁着活动买到了超值的价格，而且是京东自营，品质有保障，购物无忧。',
                    '这个产品性价比高得惊人，用着很舒心。身边的朋友看到后都想入手，看来我又要来一单了，哈哈！',
                    '京东的物流效率真是让人叹为观止，昨晚下单，今早就收到了，包装也很用心，赞！',
                    '京东真的改变了我的生活方式，商品种类繁多，自营产品更是价格优惠，让网购变得如此轻松愉快。',
                    '一直以来都是京东的忠实用户，商品品质靠谱，价格公道，物流快捷，每次购物都很放心。',
                    '这个产品的质量和性价比都超出预期，很满意这次购物。京东的配送速度也是一如既往的快！',
                    '给京东点赞！虽然评价简短，但这是发自内心的赞美，每次购物体验都很棒！',
                    '选择京东的原因很简单，今天下单，明天就能收到，这种效率真的很贴心。',
                    '非常感谢京东提供的优质服务，从商品管理到物流配送，每个环节都做得很到位，让人感到很安心。'
                ];
                tempInter = setInterval(function() {
                    window.clearInterval(tempInter);
                    $("#JDifr").contents().find(".star5:visible").each(function() {
                        isFiveStar ? $(this).click() : (Math.random(0, 1) > 0.5 ? $(this).click() : $(this).siblings('.star4').click());
                    });
                    let isTag = $("#JDifr").contents().find(".m-tagbox a");
                    if (isTag) {
                        $("#JDifr").contents().find(".m-tagbox a:first-child").addClass("tag-checked");
                    }
                    let tLen = $("#JDifr").contents().find('textarea:visible').length;
                    if (tLen) {
                        for (let ti = 0; ti < tLen; ti++) {
                            $("#JDifr").contents().find('textarea:visible').eq(ti).text(contentArr[Math.floor(contentArr.length * Math.random())]);
                        }
                    }
                    window.setTimeout(function() {
                        $("#JDifr").contents().find('.btn-submit')[0].click();
                        curId++;
                    }, 100);
                }, 50);
            }
        }
    }

    // 为按钮添加点击事件，启动评价功能
    startButton.addEventListener("click", startEvaluation);
})();
