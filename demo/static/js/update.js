// const SERVER_ENDPOINT = '//localhost:8000/demo';

// Handle 4xx, 5xx response when using Fetch API
// ref. https://blog.mudatobunka.org/entry/2016/04/26/092518
const fetchErrorHandler = res => {
  if (!res.ok) {
    throw Error(`${res.status} ${res.statusText}`);
  }
  return res;
};

let previousJobStatus = null;

const updateStatus = async () => {

  const statusElement = document.getElementsByClassName('c-status')[0];

  const updateStatusColor = colorString => {
    statusElement.classList.remove(
      'alert-primary',
      'alert-secondary',
      'alert-success',
      'alert-danger',
      'alert-warning',
      'alert-info',
      'alert-light',
      'alert-dark'
    );
    statusElement.classList.add(colorString);
  };

  const updateStatusMessage = htmlString => {
    statusElement.children[0].innerHTML = htmlString;
  };

  const hideStatusInfo = () => {
    statusElement.children[1].classList.add('c-status__info--disabled');
  };

  const showStatusInfo = () => {
    statusElement.children[1].classList.remove('c-status__info--disabled');
  };

  const updateStatusDescription = htmlString => {
    statusElement.children[1].children[1].innerHTML = htmlString;
  };

  let jobStatus;

  try {
    const data = await fetch('./status', {
      method: 'GET',
      headers: new Headers({
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      })
    }).then(fetchErrorHandler).then(res => res.json());
    jobStatus = data.jobStatus;
  } catch (e) {
    updateStatusColor('alert-danger');
    updateStatusMessage(`
      <i class="fas fa-exclamation-triangle c-status__icon"></i>
      <span class="c-status__text">Failed to fetch</span>
    `);
    updateStatusDescription('Cannot connect to the server. Retry later.');
    showStatusInfo();
    console.error(e);
    return;
  }

  if (previousJobStatus == jobStatus) {
    return;
  }
  previousJobStatus = jobStatus;

  switch (jobStatus) {

    case 'unregistered':
      updateStatusColor('alert-info');
      updateStatusMessage(`
        <i class="fas fa-info-circle c-status__icon"></i>
        <span class="c-status__text">No jobs registered</span>
      `);
      hideStatusInfo();
      break;

    case 'compiling':
      updateStatusColor('alert-info');
      updateStatusMessage(`
        <i class="fas fa-pulse fa-spinner c-status__icon"></i>
        <span class="c-status__text">Compiling job...</span>
      `);
      hideStatusInfo();
      break;

    case 'ready':
      updateStatusColor('alert-info');
      updateStatusMessage(`
        <i class="fas fa-info-circle c-status__icon"></i>
        <span class="c-status__text">Ready for execution</span>
      `);
      hideStatusInfo();
      break;

    case 'executing':
      updateStatusColor('alert-info');
      updateStatusMessage(`
        <i class="fas fa-pulse fa-spinner c-status__icon"></i>
        <span class="c-status__text">Executing job...</span>
      `);
      hideStatusInfo();
      break;

    case 'completed':
      updateStatusColor('alert-success');
      updateStatusMessage(`
        <i class="fas fa-check-circle c-status__icon"></i>
        <span class="c-status__text">Execution completed</span>
      `);
      updateStatusDescription(`
        All tasks were successfully executed.<br>
        <a href="./results" class="btn btn-success btn-lg btn-block mt-2" role="button">Get Results</a>
      `);
      showStatusInfo();
      break;

    default:
      updateStatusColor('alert-danger');
      updateStatusMessage(`
        <i class="fas fa-exclamation-triangle c-status__icon"></i>
        <span class="c-status__text">${jobStatus}</span>
      `);
      updateStatusDescription('Something went wrong.');
      showStatusInfo();

  }

};

document.addEventListener('DOMContentLoaded', async () => {
  setInterval(updateStatus, 1000);
});
