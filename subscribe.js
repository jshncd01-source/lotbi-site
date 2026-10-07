/* SITE-SUBSCRIBE-PLANS-01 — 등급 선택과 Account 결제 화면으로의 이동만 처리한다.

   이 파일은 결제를 호출하지 않는다. 구매하기는 고른 등급의 이름표(basic·plus·pro)만
   들고 LOTBI Account의 플랜 업그레이드 화면으로 넘긴다. 로그인, 금액 확인, 결제 가능
   여부 판단은 모두 Account와 Core가 한다. 가격이나 돌아올 주소는 넘기지 않는다.
   선택 자체는 결제 준비 여부와 무관하게 항상 동작해야 한다. */
(function () {
  'use strict';

  // SUBSCRIBE-ACCOUNT-CHECKOUT-HANDOFF-01: 고정된 Account 주소와 허용된 등급 이름표만 쓴다.
  var ACCOUNT_CHECKOUT_URL = 'https://account.lotbiai.com/account';
  var CHECKOUT_PLANS = { basic: 'basic', plus: 'plus', pro: 'pro' };

  function checkoutUrl(value) {
    var plan = Object.prototype.hasOwnProperty.call(CHECKOUT_PLANS, value) ? CHECKOUT_PLANS[value] : '';
    return plan ? ACCOUNT_CHECKOUT_URL + '?checkout=' + plan : '';
  }

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
      // 폼을 그대로 제출하면 이 페이지가 새로고침되며 고른 등급이 사라진다.
      event.preventDefault();
      var current = selectedRadio();
      var target = current ? checkoutUrl(current.value) : '';

      if (!target) {
        if (status) {
          status.innerHTML = '<p>먼저 등급을 하나 선택해 주세요.</p>';
          status.focus();
        }
        return;
      }

      // 이동하는 동안 무슨 일이 일어나는지 보이게 한다.
      if (status) {
        status.innerHTML =
          '<p><strong>' + planName(current) + '</strong> 결제 확인 화면으로 이동합니다. ' +
          '로그인하지 않았다면 LOTBI 로그인 후 이어집니다.</p>';
      }
      window.location.assign(target);
    });

    paint();
  });
})();
