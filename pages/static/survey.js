const c = document.createElement.bind(document);

const _safe = function (str) {
  return str.replace(/ /g, '_').replace(/[^a-zA-Z]/g, '');
};

function Fez(data) {
  if (data === null) {
    throw new Error(
      'Surveys must have an <amp-state> element, with the ID "surveyQuestions"'
    );
  }

  try {
    this.questions = this.validate(data);
    this.name = data.survey;
    this.shownAt = Date.now();
    this.slides = [];
  } catch (e) {
    throw new Error(e);
  }

  this.init();
}

Fez.prototype._questionTypes = [
  'likert',
  'multiple',
  'open',
  'rating',
  'single',
];

Fez.prototype.validate = function (data) {
  if (!Array.isArray(data.questions)) {
    throw new Error('Survey data must include questions');
  }

  data.questions.forEach((q) => {
    if (typeof q.text !== 'string') {
      throw new Error('Survey questions must include a `text` field');
    }
    if (typeof q.type !== 'string') {
      throw new Error('Survey questions must include a `type` field');
    }
    if (this._questionTypes.indexOf(q.type) === -1) {
      throw new Error(q.type + ' is not a valid survey question type');
    }
  });

  return data.questions;
};

Fez.prototype.init = function () {
  const answerExpiration = localStorage[`survey_${this.name}`];
  const surveyTimestamp = parseInt(answerExpiration);

  // if the answer expired, or there is no saved answer
  // (and is therefore a NaN when parsed)...
  if (Number.isNaN(surveyTimestamp) || Date.now() > new Date(surveyTimestamp)) {
    delete localStorage[`survey_${this.name}`];

    this.build();
  }
};

Fez.prototype._attachListeners = function () {
  const inputs = [
    ...document.querySelectorAll('[type=radio]'),
    ...document.querySelectorAll('[type=button]'),
  ];

  inputs.forEach((e) =>
    e.addEventListener('click', (e) => {
      const el = e.target;
      let card = el;

      while (card && !card.classList.contains('active')) {
        card = card.parentNode;
      }

      const index = card.parentNode.childNodes.indexOf(card);
      const question = this.questions[index];

      if (question.type === 'likert' || question.type === 'rating') {
        question.answer = el.nextSibling.textContent;
      } else if (question.type === 'open') {
        question.answer = card.querySelector('textarea').value;
      }

      this.nextSlide();
    })
  );

  setTimeout(this.nextSlide, 500);
};

Fez.prototype.nextSlide = async function () {
  const form = document.querySelector('#fez');

  let cards = form.children;
  const currentCard = form.querySelector('.active');
  let currentIndex = cards.indexOf(currentCard);
  const nextIndex = (currentIndex += 1);

  if (nextIndex === cards.length) {
    const thanks = c('div');
    const msg = c('p');

    thanks.className = 'slide';
    msg.className = 'surveyQuestion thanks';

    msg.textContent = 'Thank you!';

    thanks.appendChild(msg);
    form.appendChild(thanks);
    cards = form.children;
  }

  if (nextIndex < cards.length) {
    if (currentCard) {
      currentCard.classList.remove('active');
    }

    cards[nextIndex].classList.add('active');

    if (nextIndex + 1 === cards.length) {
      this.submit();
    }
  }

  const {height} = await cards[nextIndex].getBoundingClientRectAsync();

  form.style.height = `${height}px`;
};

Fez.prototype.submit = function () {
  debugger;

  fetch(`${self.location.origin}/fez-survey-response`, {
    method: 'POST',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      'survey': this.name,
      'questions': this.questions,
      'shownAt': `"${this.shownAt}"`,
    }),
  });

  // store the fact we replied to the survey for 4 weeks
  localStorage[`survey_${this.name}`] = this.shownAt + 1000 * 60 * 60 * 24 * 28;
};

Fez.prototype.build = function () {
  const form = c('form');
  form.id = 'fez';

  const X = c('div');
  X.id = 'dismiss';

  this.questions.forEach((q, i) => {
    this.slides.push(new FezSlide(q, i));
  });

  form.innerHTML = this.slides.join('');

  document.body.appendChild(form, X);
  this._attachListeners();
};

function FezSlide(data, index) {
  const wrap = c('div');
  const question = c('p');

  wrap.classList.add('slide');
  question.classList.add('surveyQuestion');

  wrap.appendChild(question);
  question.textContent = data.text;

  if (data.type === 'rating' || data.type === 'likert') {
    const ul = c('ul');
    const values = data.values || [
      'strongly agree',
      'agree',
      'neutral',
      'disagree',
      'strongly disagree',
    ];

    values.forEach((v) => {
      const li = c('li');
      const rating = c('input');
      const label = c('label');

      rating.type = 'radio';

      li.appendChild(rating);
      rating.name = _safe(data.text);
      rating.value = _safe(v);
      rating.id = label.htmlFor = `survey_card_${index}_${_safe(v)}`;

      label.textContent = v;

      li.appendChild(label);

      ul.appendChild(li);
    });

    wrap.appendChild(ul);
  }

  if (data.type === 'open') {
    const textarea = c('textarea');

    wrap.appendChild(textarea);

    const buttonWrapper = c('div');

    buttonWrapper.className = 'buttons';

    const skip = c('button');
    const submit = c('button');

    skip.type = submit.type = 'button';

    skip.className = 'button-negative';
    submit.className = 'button-affirm';

    skip.textContent = 'Nope!';
    submit.textContent = 'Submit';

    buttonWrapper.appendChild(skip);
    buttonWrapper.appendChild(submit);

    wrap.appendChild(buttonWrapper);
  }

  this.toString = function () {
    return wrap.outerHTML;
  };
}

AMP.getState('surveyQuestions').then((data) => new Fez(JSON.parse(data)));
