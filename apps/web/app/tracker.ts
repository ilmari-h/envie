export const tracker = (eventName: string) => {
  if((window as any).gtag) {
    (window as any).gtag('event', eventName);
  }
};

export const recordConversion = (value: number) => {
  if((window as any).gtag) {
    (window as any).gtag('event', "conversion", {
      'send_to': 'AW-16519815193/-I84COnLkpsbEJnAocU9',
      'value': value,
      'currency': 'USD'
    });
  }

};