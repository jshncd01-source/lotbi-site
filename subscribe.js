/* SITE-SUBSCRIBE-PLANS-01 — 등급 선택만 처리한다.

   이 파일은 결제를 호출하지 않는다. 결제 경로는 PG 심사가 끝난 뒤 별도로 열며,
   여기서는 어떤 등급을 골랐는지 화면에 반영하고 지금 결제가 어디까지 준비됐는지
   알려주는 일만 한다. 선택 자체는 결제 준비 여부와 무관하게 항상 동작해야 한다. */
(function () {
  'use strict';

  function ready(run) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  ready(function () {
    var form = document.getElementById('plan-form');
    if (!form) return;

    var cards = Array.prototype.slice.call(form.querySelectorAll('[data-plan-card]'));
    var radios = Array.prototype.slice.call(form.querySelectorAll('input[name="plan"]'));
    var readout = document.getElementById('plan-selected-readout');
    var status = document.getElementById('plan-status');
    if (!cards.length || !radios.length) return;

    function selectedRadio() {
      for (var i = 0; i < radios.length; i += 1) {
        if (radios[i].checked) return radios[i];
      }
      return null;
    }

    function planName(radio) {
      return (radio && radio.getAttribute('data-plan-name')) || '';
    }

    function paint() {
      var current = selectedRadio();
      cards.forEach(function (card) {
        var radio = card.querySelector('input[name="plan"]');
        card.setAttribute('data-selected', radio && radio.checked ? 'true' : 'false');
      });
      if (readout) {
        readout.innerHTML = current
          ? '선택한 등급: <strong>' + planName(current) + '</strong>'
          : '등급을 하나 선택해 주세요.';
      }
    }

    // 카드의 빈 곳을 눌러도 골라지게 한다. 라벨 안의 링크나 라디오 자체를 누른
    // 경우는 브라우저가 이미 처리하므로 여기서 다시 건드리지 않는다.
    cards.forEach(function (card) {
      card.addEventListener('click', function (event) {
        if (event.target.closest('a, input, button')) return;
        var radio = card.querySelector('input[name="plan"]');
        if (!radio || radio.checked) return;
        radio.checked = true;
        paint();
      });
    });

    radios.forEach(function (radio) {
      radio.addEventListener('change', paint);
    });

    form.addEventListener('submit', function (event) {
      // 결제창이 아직 없다. 제출을 그대로 두면 페이지가 새로고침되면서
      // 고른 등급이 사라진다.
      event.preventDefault();
      var current = selectedRadio();
      if (!status) return;

      if (!current) {
        status.innerHTML = '<p>먼저 등급을 하나 선택해 주세요.</p>';
        status.focus();
        return;
      }

      // 막다른 길을 만들지 않는다 — 지금 할 수 있는 것을 함께 안내한다.
      status.innerHTML =
        '<p><strong>' + planName(current) + '</strong> 등급을 선택하셨습니다. ' +
        '카드 결제는 결제대행사 가맹 심사가 끝나는 대로 이 화면에서 바로 열립니다.</p>' +
        '<p>그때까지 LOTBI는 무료 이용 범위 안에서 그대로 쓰실 수 있습니다. ' +
        '결제가 열리면 알려드릴까요? <a href="contact.html">문의하기</a>로 남겨주시면 ' +
        '준비되는 대로 안내드리겠습니다.</p>';
      status.focus();
    });

    paint();
  });
})();
